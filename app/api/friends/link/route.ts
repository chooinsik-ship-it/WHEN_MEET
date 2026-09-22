import { NextResponse, type NextRequest } from 'next/server';
import { requireSession, sessionNickname } from '../../../lib/apiAuth';

const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

const nicknameToId = (nickname: string) =>
  Math.abs(nickname.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0));

const friendsKey = (userId: number) => `friends:${userId}`;

async function readFriends(userId: number): Promise<string[]> {
  const { kv } = await import('@vercel/kv');
  return (await kv.get<string[]>(friendsKey(userId))) ?? [];
}

async function writeFriends(userId: number, list: string[]): Promise<void> {
  const { kv } = await import('@vercel/kv');
  await kv.set(friendsKey(userId), [...new Set(list)]);
}

/**
 * POST /api/friends/link
 * 친구 요청 수락 — 양쪽 목록에 서로를 추가한다.
 *
 * 남의 친구 목록을 건드리는 동작이므로, 요청자에게 상대가 보낸
 * friend_request 알림이 실제로 있는지 서버가 확인한 뒤에만 연결한다.
 */
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  const { partnerNickname } = await request.json();
  if (typeof partnerNickname !== 'string' || !partnerNickname.trim()) {
    return NextResponse.json({ error: '상대 닉네임이 필요합니다.' }, { status: 422 });
  }

  if (!isKvConfigured) return NextResponse.json({ success: true });

  const me = session.userId;
  const myNickname = await sessionNickname(me);
  if (!myNickname) {
    return NextResponse.json({ error: '내 프로필을 찾을 수 없습니다.' }, { status: 409 });
  }

  const partner = partnerNickname.trim();
  const partnerId = nicknameToId(partner);

  const { kv } = await import('@vercel/kv');
  const [myFriends, partnerFriends, notifications] = await Promise.all([
    readFriends(me),
    readFriends(partnerId),
    kv.get<{ type?: string; fromNickname?: string }[]>(`notifications:${me}`),
  ]);

  // 이미 친구면 그대로 성공 (재시도·중복 클릭 대비)
  const alreadyLinked = myFriends.includes(partner) && partnerFriends.includes(myNickname);

  if (!alreadyLinked) {
    const hasRequest = (notifications ?? []).some(
      n => n?.type === 'friend_request' && n?.fromNickname === partner
    );
    if (!hasRequest) {
      return NextResponse.json(
        { error: '해당 사용자의 친구 요청이 없습니다.', code: 'NO_REQUEST' },
        { status: 403 }
      );
    }
  }

  await Promise.all([
    writeFriends(me, [...myFriends, partner]),
    writeFriends(partnerId, [...partnerFriends, myNickname]),
  ]);

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/friends/link
 * 친구 삭제 — 양쪽 목록에서 서로를 제거한다 (한쪽이 끊으면 관계가 끝나는 게 맞다).
 */
export async function DELETE(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  const { partnerNickname } = await request.json();
  if (typeof partnerNickname !== 'string' || !partnerNickname.trim()) {
    return NextResponse.json({ error: '상대 닉네임이 필요합니다.' }, { status: 422 });
  }

  if (!isKvConfigured) return NextResponse.json({ success: true });

  const me = session.userId;
  const myNickname = await sessionNickname(me);
  const partner = partnerNickname.trim();
  const partnerId = nicknameToId(partner);

  const [myFriends, partnerFriends] = await Promise.all([readFriends(me), readFriends(partnerId)]);

  await Promise.all([
    writeFriends(me, myFriends.filter(f => f !== partner)),
    myNickname ? writeFriends(partnerId, partnerFriends.filter(f => f !== myNickname)) : Promise.resolve(),
  ]);

  return NextResponse.json({ success: true });
}
