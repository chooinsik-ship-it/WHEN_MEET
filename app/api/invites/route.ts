import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { requireSession, sessionNickname } from '../../lib/apiAuth';

const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/** 초대 링크 유효 기간 */
const TTL_SEC = 60 * 60 * 24 * 7;

/**
 * POST /api/invites
 * 내 초대 링크 생성.
 *
 * 지금까지는 상대 닉네임을 정확히 알아야만 친구를 추가할 수 있었다.
 * 초대 코드를 만들어 카톡 등으로 보내면, 받은 사람이 링크만 열어 친구가 될 수 있다.
 */
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  if (!isKvConfigured) {
    return NextResponse.json({ error: '서버 저장소가 설정되지 않았습니다.' }, { status: 503 });
  }

  const nickname = await sessionNickname(session.userId);
  if (!nickname) {
    return NextResponse.json({ error: '프로필을 먼저 저장해주세요.' }, { status: 409 });
  }

  const { kv } = await import('@vercel/kv');
  // 읽기 쉬운 코드 (헷갈리는 글자 제외)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');

  await kv.set(
    `invite:${code}`,
    { nickname, userId: session.userId, createdAt: Date.now() },
    { ex: TTL_SEC }
  );

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    code,
    url: `${origin}/?invite=${code}`,
    expiresInDays: TTL_SEC / (60 * 60 * 24),
  });
}
