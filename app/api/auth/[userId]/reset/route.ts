import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { attachSessionCookie, createSessionToken } from '../../../../lib/session';
import { checkResetAttempts, hashCode, recoveryKey } from '../../../../lib/recovery';

const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update('whenmeet_salt_' + password).digest('hex');
}

/**
 * POST /api/auth/[userId]/reset
 * body: { code, newPassword }
 *
 * 로그인하지 않은 상태에서 호출된다(비밀번호를 잊은 상황).
 * 복구 코드가 맞으면 비밀번호를 바꾸고, 그 코드는 폐기한 뒤 세션을 발급한다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const { code, newPassword } = await request.json();

  if (!code || !newPassword) {
    return NextResponse.json({ error: '복구 코드와 새 비밀번호를 입력해주세요.' }, { status: 400 });
  }
  if (String(newPassword).length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상으로 정해주세요.' }, { status: 400 });
  }

  if (!isKvConfigured) {
    return NextResponse.json({ error: '서버 저장소가 설정되지 않았습니다.' }, { status: 503 });
  }

  try {
    // 무차별 대입 방지
    if (!(await checkResetAttempts(userId))) {
      return NextResponse.json(
        { error: '시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const { kv } = await import('@vercel/kv');
    const storedCodeHash = await kv.get<string>(recoveryKey(userId));

    // 코드가 없는 계정과 틀린 코드를 구분하지 않는다 (계정 존재 여부 탐색 방지)
    if (!storedCodeHash || storedCodeHash !== hashCode(String(code))) {
      return NextResponse.json({ error: '복구 코드가 올바르지 않습니다.' }, { status: 401 });
    }

    await kv.set(`password:${userId}`, hashPassword(newPassword));
    // 1회용 — 사용 즉시 폐기
    await kv.del(recoveryKey(userId));

    const response = NextResponse.json({ success: true });
    try {
      return attachSessionCookie(response, await createSessionToken(Number(userId)));
    } catch {
      return response;
    }
  } catch (error) {
    console.error('[reset] error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
