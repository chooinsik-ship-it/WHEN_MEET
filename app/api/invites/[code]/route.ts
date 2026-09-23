import { NextResponse, type NextRequest } from 'next/server';
import { requireSession, sessionNickname } from '../../../lib/apiAuth';

const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

interface Invite {
  nickname: string;
  userId: number;
  createdAt: number;
}

const nicknameToId = (nickname: string) =>
  Math.abs(nickname.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0));

/**
 * GET /api/invites/[code]
 * 초대한 사람 닉네임만 알려준다 (로그인 전에도 확인 가능해야 한다).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!isKvConfigured) return NextResponse.json({ error: '사용할 수 없습니다.' }, { status: 503 });

  const { kv } = await import('@vercel/kv');
  const invite = await kv.get<Invite>(`invite:${code}`);

  if (!invite) {
    return NextResponse.json({ error: '만료되었거나 잘못된 초대 링크예요.' }, { status: 404 });
  }
  return NextResponse.json({ nickname: invite.nickname });
}

/**
 * POST /api/invites/[code]
 * 초대 수락 — 양쪽 친구 목록을 연결한다.
 * 초대 링크를 만든 행위 자체가 초대자의 동의이므로 별도 요청 알림은 필요 없다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  const { code } = await params;
  if (!isKvConfigured) return NextResponse.json({ error: '사용할 수 없습니다.' }, { status: 503 });

  const { kv } = await import('@vercel/kv');
  const invite = await kv.get<Invite>(`invite:${code}`);
  if (!invite) {
    return NextResponse.json({ error: '만료되었거나 잘못된 초대 링크예요.' }, { status: 404 });
  }

  const myNickname = await sessionNickname(session.userId);
  if (!myNickname) {
    return NextResponse.json({ error: '프로필을 먼저 저장해주세요.' }, { status: 409 });
  }
  if (myNickname === invite.nickname) {
    return NextResponse.json({ error: '내가 만든 초대 링크예요.', code: 'SELF' }, { status: 400 });
  }

  const inviterId = invite.userId ?? nicknameToId(invite.nickname);
  const [mine, theirs] = await Promise.all([
    kv.get<string[]>(`friends:${session.userId}`),
    kv.get<string[]>(`friends:${inviterId}`),
  ]);

  await Promise.all([
    kv.set(`friends:${session.userId}`, [...new Set([...(mine ?? []), invite.nickname])]),
    kv.set(`friends:${inviterId}`, [...new Set([...(theirs ?? []), myNickname])]),
  ]);

  // 초대자에게 알림
  const notifKey = `notifications:${inviterId}`;
  const existing = (await kv.get<unknown[]>(notifKey)) ?? [];
  await kv.set(notifKey, [
    {
      id: `invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'friend_accepted',
      message: `🎉 ${myNickname}님이 초대 링크로 친구가 되었어요.`,
      fromNickname: myNickname,
      createdAt: new Date().toISOString(),
      read: false,
    },
    ...existing,
  ]);

  return NextResponse.json({ success: true, nickname: invite.nickname });
}
