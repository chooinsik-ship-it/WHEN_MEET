import { NextResponse, type NextRequest } from 'next/server';
import { isKvConfigured, requireSession, sessionNickname } from '../../../lib/apiAuth';
import { candidateKey } from '../../../lib/poll';
import { cancelPoll, castVote, confirmPoll, getPoll, getVotes } from '../../../lib/pollStore';

type Ctx = { params: Promise<{ pollId: string }> };

/** 요청자가 이 투표의 멤버인지 확인하고 투표를 돌려준다 */
async function loadForMember(request: NextRequest, ctx: Ctx) {
  const session = await requireSession(request);
  if (!session.ok) return { error: session.response };
  if (!isKvConfigured) {
    return { error: NextResponse.json({ error: '저장소가 설정되지 않았습니다.' }, { status: 503 }) };
  }

  const { pollId } = await ctx.params;
  const poll = await getPoll(pollId);
  if (!poll) return { error: NextResponse.json({ error: '투표를 찾을 수 없습니다.' }, { status: 404 }) };

  const nickname = await sessionNickname(session.userId);
  if (!nickname || !poll.members.includes(nickname)) {
    return { error: NextResponse.json({ error: '이 투표의 멤버가 아닙니다.' }, { status: 403 }) };
  }
  return { poll, nickname };
}

/** POST /api/polls/[pollId]  투표하기  body: { votes: 후보 키 배열 } ([] = 모두 안 됨) */
export async function POST(request: NextRequest, ctx: Ctx) {
  const loaded = await loadForMember(request, ctx);
  if ('error' in loaded) return loaded.error;
  const { poll, nickname } = loaded;

  if (poll.status !== 'open') {
    return NextResponse.json({ error: '이미 마감된 투표입니다.' }, { status: 409 });
  }
  const { votes } = (await request.json().catch(() => ({}))) ?? {};
  if (!Array.isArray(votes)) {
    return NextResponse.json({ error: 'votes 배열이 필요합니다.' }, { status: 422 });
  }

  return NextResponse.json(await castVote(poll, nickname, votes.map(String)));
}

/** PATCH /api/polls/[pollId]  만든 사람이 직접 확정  body: { confirm: 후보 키 } */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const loaded = await loadForMember(request, ctx);
  if ('error' in loaded) return loaded.error;
  const { poll, nickname } = loaded;

  if (poll.createdBy !== nickname) {
    return NextResponse.json({ error: '투표를 만든 사람만 확정할 수 있습니다.' }, { status: 403 });
  }
  if (poll.status !== 'open') {
    return NextResponse.json({ error: '이미 마감된 투표입니다.' }, { status: 409 });
  }

  const { confirm } = (await request.json().catch(() => ({}))) ?? {};
  const candidate = poll.candidates.find(c => candidateKey(c) === confirm);
  if (!candidate) return NextResponse.json({ error: '후보를 찾을 수 없습니다.' }, { status: 422 });

  const confirmed = await confirmPoll(poll, candidate);
  return NextResponse.json({ poll: confirmed, votes: await getVotes(poll.id) });
}

/** DELETE /api/polls/[pollId]  만든 사람이 투표 취소 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const loaded = await loadForMember(request, ctx);
  if ('error' in loaded) return loaded.error;
  const { poll, nickname } = loaded;

  if (poll.createdBy !== nickname) {
    return NextResponse.json({ error: '투표를 만든 사람만 취소할 수 있습니다.' }, { status: 403 });
  }
  await cancelPoll(poll);
  return NextResponse.json({ success: true });
}
