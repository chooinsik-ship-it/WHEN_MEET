import { NextResponse, type NextRequest } from 'next/server';
import { isKvConfigured, requireSession, sessionNickname } from '../../lib/apiAuth';
import { isValidCandidate, POLL_LIMITS, type Poll } from '../../lib/poll';
import { createPoll, getGroupPoll } from '../../lib/pollStore';

/**
 * GET /api/polls?groupId=...  그룹의 진행 중(또는 마지막) 투표
 * 투표 멤버만 볼 수 있다.
 */
export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  const groupId = new URL(request.url).searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId 가 필요합니다.' }, { status: 400 });
  if (!isKvConfigured) return NextResponse.json({ poll: null, votes: {} });

  const view = await getGroupPoll(groupId);
  if (!view) return NextResponse.json({ poll: null, votes: {} });

  const nickname = await sessionNickname(session.userId);
  if (!nickname || !view.poll.members.includes(nickname)) {
    return NextResponse.json({ poll: null, votes: {} });
  }
  return NextResponse.json(view);
}

/**
 * POST /api/polls  투표 만들기
 * body: { groupId, groupName, title, place?, duration, candidates, members }
 */
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  const body = await request.json().catch(() => null);
  const { groupId, groupName, title, place, duration, candidates, members } = body ?? {};

  const invalid = (message: string) => NextResponse.json({ error: message }, { status: 422 });
  if (typeof groupId !== 'string' || !groupId) return invalid('groupId 가 필요합니다.');
  if (!Array.isArray(candidates) || candidates.length === 0 || candidates.length > POLL_LIMITS.maxCandidates) {
    return invalid(`후보는 1~${POLL_LIMITS.maxCandidates}개여야 합니다.`);
  }
  if (!candidates.every(isValidCandidate)) return invalid('후보 날짜/시간 형식이 올바르지 않습니다.');
  if (!Number.isInteger(duration) || duration < POLL_LIMITS.minDuration || duration > POLL_LIMITS.maxDuration) {
    return invalid('약속 길이가 올바르지 않습니다.');
  }
  if (!Array.isArray(members) || !members.every(m => typeof m === 'string' && m)) {
    return invalid('멤버 목록이 필요합니다.');
  }

  if (!isKvConfigured) return NextResponse.json({ poll: null, votes: {} });

  const nickname = await sessionNickname(session.userId);
  if (!nickname) return NextResponse.json({ error: '내 프로필을 찾을 수 없습니다.' }, { status: 409 });

  const uniqueMembers = [...new Set<string>([nickname, ...members])];
  if (uniqueMembers.length < 2 || uniqueMembers.length > POLL_LIMITS.maxMembers) {
    return invalid(`멤버는 2~${POLL_LIMITS.maxMembers}명이어야 합니다.`);
  }

  // 같은 후보가 두 번 들어오지 않도록
  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter(c => {
    const k = `${c.date}T${c.hour}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const poll: Poll = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    groupId,
    groupName: String(groupName ?? '').slice(0, POLL_LIMITS.titleMax) || '그룹',
    title: String(title ?? '').trim().slice(0, POLL_LIMITS.titleMax) || '약속',
    ...(typeof place === 'string' && place.trim() ? { place: place.trim().slice(0, POLL_LIMITS.placeMax) } : {}),
    duration,
    candidates: uniqueCandidates.map(c => ({ date: c.date, hour: c.hour })),
    members: uniqueMembers,
    createdBy: nickname,
    createdAt: new Date().toISOString(),
    status: 'open',
  };

  return NextResponse.json(await createPoll(poll));
}
