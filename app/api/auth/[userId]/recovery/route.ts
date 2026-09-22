import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { requireSelf } from '../../../../lib/apiAuth';
import { generateRecoveryCode, hashCode, recoveryKey } from '../../../../lib/recovery';

const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update('whenmeet_salt_' + password).digest('hex');
}

/**
 * GET /api/auth/[userId]/recovery
 * 복구 코드가 발급돼 있는지 여부만 알려준다 (코드 자체는 절대 다시 보여주지 않는다)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = await requireSelf(request, userId);
  if (!session.ok) return session.response;

  if (!isKvConfigured) return NextResponse.json({ hasCode: false });

  const { kv } = await import('@vercel/kv');
  const stored = await kv.get<string>(recoveryKey(userId));
  return NextResponse.json({ hasCode: Boolean(stored) });
}

/**
 * POST /api/auth/[userId]/recovery
 * 복구 코드 발급/재발급. 본인 확인을 위해 현재 비밀번호를 요구한다.
 * 평문 코드는 이 응답에서 딱 한 번만 돌려준다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = await requireSelf(request, userId);
  if (!session.ok) return session.response;

  const { password } = await request.json();
  if (!password) {
    return NextResponse.json({ error: '현재 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  if (!isKvConfigured) {
    return NextResponse.json({ code: generateRecoveryCode(), local: true });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const storedHash = await kv.get<string>(`password:${userId}`);

    if (!storedHash || storedHash !== hashPassword(password)) {
      return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    const code = generateRecoveryCode();
    await kv.set(recoveryKey(userId), hashCode(code));

    // 평문은 여기서만 노출된다
    return NextResponse.json({ code });
  } catch (error) {
    console.error('[recovery] error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
