/**
 * 일반 API 인증 헬퍼
 *
 * 기존 API들은 URL의 userId 만 보고 아무 검증 없이 읽고 썼다.
 * 닉네임 해시가 곧 userId 라서, 닉네임만 알면 남의 시간표를 읽고 덮어쓸 수 있었다.
 * 로그인 시 발급되는 서명 세션 쿠키(wm_session)로 요청자를 확인한다.
 *
 * 권한 정책
 *  - 쓰기: 본인 데이터만 (requireSelf)
 *  - 읽기: 로그인 필수 (requireSession) — 친구 시간표 비교 때문에 타인 조회는 허용
 *    ⚠️ 친구 관계가 아직 클라이언트(localStorage)에만 있어 서버가 친구 여부를 검증할 수 없다.
 *       서버 친구 관계가 도입되면 읽기도 "본인 또는 친구/같은 그룹"으로 좁혀야 한다.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getUserIdFromRequest } from './session';

export const isKvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

export type AuthResult =
  | { ok: true; userId: number }
  | { ok: false; response: NextResponse };

function fail(message: string, code: string, status: number): AuthResult {
  return { ok: false, response: NextResponse.json({ error: message, code }, { status }) };
}

/** 로그인한 사용자인지 확인 */
export async function requireSession(request: NextRequest): Promise<AuthResult> {
  // KV가 없는 로컬 환경은 기존처럼 통과 (저장되는 데이터 자체가 없음)
  if (!isKvConfigured) return { ok: true, userId: 0 };

  const userId = await getUserIdFromRequest(request);
  if (userId === null) {
    return fail(
      '로그인이 필요합니다. 로그아웃 후 다시 로그인해주세요.',
      'UNAUTHORIZED',
      401
    );
  }
  return { ok: true, userId };
}

/** 본인 데이터인지까지 확인 */
export async function requireSelf(
  request: NextRequest,
  targetUserId: string | number
): Promise<AuthResult> {
  const session = await requireSession(request);
  if (!session.ok) return session;
  if (!isKvConfigured) return session;

  if (String(session.userId) !== String(targetUserId)) {
    return fail('본인의 데이터만 변경할 수 있습니다.', 'FORBIDDEN', 403);
  }
  return session;
}

/** 세션 사용자의 표시 닉네임 (발신자 위조 방지용) */
export async function sessionNickname(userId: number): Promise<string | null> {
  if (!isKvConfigured) return null;
  try {
    const { kv } = await import('@vercel/kv');
    const user = await kv.get<Record<string, unknown>>(`user:${userId}`);
    const nickname = user?.nickname;
    return typeof nickname === 'string' ? nickname : null;
  } catch {
    return null;
  }
}
