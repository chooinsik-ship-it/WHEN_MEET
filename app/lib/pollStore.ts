/**
 * 약속 시간 투표 — 서버 저장소
 *
 * 그룹 정보는 아직 각자의 localStorage 에만 있어 서버가 그룹 멤버를 모른다.
 * 그래서 투표가 만들어질 때의 멤버 명단(poll.members)을 투표에 함께 저장하고,
 * 이후 조회·투표·확정 권한은 그 명단으로 판단한다.
 *
 * 저장 구조 (모두 30일 뒤 자동 만료)
 *   poll:<pollId>           Poll
 *   poll-votes:<pollId>     Hash { 닉네임: 후보 키 배열 }  — 동시 투표가 서로를 덮어쓰지 않도록 해시 필드 단위로 쓴다
 *   group-poll:<groupId>    진행 중(또는 마지막) 투표 ID
 *   poll-lock:<pollId>      확정 중복 방지 락
 */
import {
  candidateKey,
  everyoneVoted,
  formatSlot,
  nicknameToId,
  pickWinner,
  weekdayIndex,
  type Poll,
  type PollCandidate,
  type PollVotes,
} from './poll';
import { sendPushToUser } from './push';

const TTL = 60 * 60 * 24 * 30;

const pollKey = (id: string) => `poll:${id}`;
const votesKey = (id: string) => `poll-votes:${id}`;
const groupKey = (groupId: string) => `group-poll:${groupId}`;

async function kvClient() {
  const { kv } = await import('@vercel/kv');
  return kv;
}

export interface PollView {
  poll: Poll;
  votes: PollVotes;
}

export async function getPoll(pollId: string): Promise<Poll | null> {
  const kv = await kvClient();
  return (await kv.get<Poll>(pollKey(pollId))) ?? null;
}

export async function getVotes(pollId: string): Promise<PollVotes> {
  const kv = await kvClient();
  const raw = (await kv.hgetall<Record<string, unknown>>(votesKey(pollId))) ?? {};
  const votes: PollVotes = {};
  for (const [nickname, value] of Object.entries(raw)) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) votes[nickname] = parsed.map(String);
  }
  return votes;
}

export async function getGroupPoll(groupId: string): Promise<PollView | null> {
  const kv = await kvClient();
  const pollId = await kv.get<string>(groupKey(groupId));
  if (!pollId) return null;
  const poll = await getPoll(pollId);
  if (!poll) return null;
  return { poll, votes: await getVotes(pollId) };
}

async function savePoll(poll: Poll): Promise<void> {
  const kv = await kvClient();
  await kv.set(pollKey(poll.id), poll, { ex: TTL });
}

/** 알림 1건 저장 + 웹 푸시 (notifications API 의 단건 추가와 같은 형식) */
async function notify(nickname: string, type: string, message: string): Promise<void> {
  const kv = await kvClient();
  const userId = nicknameToId(nickname);
  const key = `notifications:${userId}`;
  const existing = (await kv.get<unknown[]>(key)) ?? [];
  const notification = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await kv.set(key, [notification, ...existing]);
  await sendPushToUser(userId, { title: '언제만나', body: message, url: '/', tag: type });
}

export async function createPoll(poll: Poll): Promise<PollView> {
  const kv = await kvClient();
  await savePoll(poll);
  await kv.set(groupKey(poll.groupId), poll.id, { ex: TTL });

  // 만든 사람은 첫 후보들을 모두 "가능"으로 둔다 — 본인이 고른 후보이므로
  await kv.hset(votesKey(poll.id), { [poll.createdBy]: JSON.stringify(poll.candidates.map(candidateKey)) });
  await kv.expire(votesKey(poll.id), TTL);

  await Promise.all(
    poll.members
      .filter(m => m !== poll.createdBy)
      .map(m =>
        notify(
          m,
          'poll_open',
          `🗳️ ${poll.createdBy}님이 [${poll.groupName}] 그룹에서 [${poll.title}] 약속 시간 투표를 열었어요. 그룹에서 가능한 시간을 골라주세요!`
        )
      )
  );

  return { poll, votes: await getVotes(poll.id) };
}

/**
 * 투표 (다시 투표하면 덮어쓴다). 전원이 투표를 마치면 최다 득표 후보로 자동 확정한다.
 */
export async function castVote(poll: Poll, nickname: string, keys: string[]): Promise<PollView> {
  const kv = await kvClient();
  const valid = new Set(poll.candidates.map(candidateKey));
  const clean = [...new Set(keys.filter(k => valid.has(k)))];

  await kv.hset(votesKey(poll.id), { [nickname]: JSON.stringify(clean) });
  const votes = await getVotes(poll.id);

  if (poll.status === 'open' && everyoneVoted(poll, votes)) {
    const winner = pickWinner(poll, votes);
    if (winner) {
      const confirmed = await confirmPoll(poll, winner);
      return { poll: confirmed, votes };
    }
  }
  return { poll, votes };
}

/**
 * 확정: 모든 멤버의 약속 목록에 날짜 약속을 넣고 알림을 보낸다.
 * 자동 확정과 수동 확정이 겹쳐도 한 번만 처리되도록 락을 건다.
 */
export async function confirmPoll(poll: Poll, candidate: PollCandidate): Promise<Poll> {
  const kv = await kvClient();
  const locked = await kv.set(`poll-lock:${poll.id}`, 1, { nx: true, ex: 60 });
  if (!locked) return (await getPoll(poll.id)) ?? poll;

  const appointment = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: poll.title,
    ...(poll.place ? { place: poll.place } : {}),
    date: candidate.date,
    day: weekdayIndex(candidate.date),
    startHour: candidate.hour,
    endHour: Math.min(24, candidate.hour + poll.duration),
    participants: poll.members,
    acceptedBy: poll.members,
    createdAt: new Date().toISOString(),
    status: 'confirmed' as const,
    pollId: poll.id,
  };

  const confirmed: Poll = { ...poll, status: 'confirmed', confirmed: candidate, appointmentId: appointment.id };
  await savePoll(confirmed);

  const when = formatSlot(candidate, poll.duration);
  await Promise.all(
    poll.members.map(async (m) => {
      const key = `appointments:${nicknameToId(m)}`;
      const list = (await kv.get<{ pollId?: string }[]>(key)) ?? [];
      if (!list.some(a => a.pollId === poll.id)) {
        await kv.set(key, [...list, appointment]);
      }
      await notify(m, 'poll_confirmed', `🎉 [${poll.title}] 약속이 ${when}으로 확정됐어요!`);
    })
  );

  return confirmed;
}

export async function cancelPoll(poll: Poll): Promise<void> {
  const kv = await kvClient();
  await savePoll({ ...poll, status: 'cancelled' });
  const current = await kv.get<string>(groupKey(poll.groupId));
  if (current === poll.id) await kv.del(groupKey(poll.groupId));
}
