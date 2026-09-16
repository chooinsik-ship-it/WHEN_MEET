/**
 * 게임 API용 세션
 *
 * 기존 로그인은 "닉네임 → userId 해시 + 비밀번호 검증"만 하고 상태를 남기지 않았다.
 * 게임 기록·랭킹은 요청자를 서버가 신뢰할 수 있어야 하므로,
 * 로그인 성공 시 서버가 서명한 토큰을 httpOnly 쿠키로 내려주고
 * 게임 API는 요청 본문의 userId 대신 이 쿠키만 신뢰한다.
 *
 * 서명 키는 KV에 한 번 생성해 보관한다(새 환경변수 불필요).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'wm_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30;
const SECRET_KEY = 'wg:session-secret';

const isKvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

/** KV를 못 쓰는 로컬 환경용 폴백 (프로세스 수명 동안만 유효) */
const fallbackSecret = randomBytes(32).toString('hex');
let cachedSecret: string | null = null;

async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  if (!isKvConfigured) {
    cachedSecret = process.env.WORDGAME_SESSION_SECRET ?? fallbackSecret;
    return cachedSecret;
  }

  const { kv } = await import('@vercel/kv');
  const existing = await kv.get<string>(SECRET_KEY);
  if (existing) {
    cachedSecret = existing;
    return existing;
  }

  const created = randomBytes(32).toString('hex');
  // 동시 생성 경쟁 방지: 먼저 쓴 쪽의 값을 사용한다
  const stored = await kv.set(SECRET_KEY, created, { nx: true });
  if (stored) {
    cachedSecret = created;
    return created;
  }
  cachedSecret = (await kv.get<string>(SECRET_KEY)) ?? created;
  return cachedSecret;
}

const b64url = (input: string) => Buffer.from(input, 'utf8').toString('base64url');
const unb64url = (input: string) => Buffer.from(input, 'base64url').toString('utf8');

export async function createSessionToken(userId: number): Promise<string> {
  const secret = await getSecret();
  const payload = b64url(JSON.stringify({ uid: userId, iat: Date.now() }));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** 토큰 검증 → userId (실패 시 null) */
export async function verifySessionToken(token: string | undefined): Promise<number | null> {
  if (!token || !token.includes('.')) return null;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const secret = await getSecret();
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(unb64url(payload)) as { uid?: unknown; iat?: unknown };
    if (typeof parsed.uid !== 'number' || typeof parsed.iat !== 'number') return null;
    if (Date.now() - parsed.iat > MAX_AGE_SEC * 1000) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

/** 요청에서 로그인 사용자 확인 */
export async function getUserIdFromRequest(request: NextRequest): Promise<number | null> {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

/** 응답에 세션 쿠키 심기 */
export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax', // 외부 사이트의 교차 출처 POST로는 전송되지 않음 (CSRF 기본 방어)
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SEC,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
