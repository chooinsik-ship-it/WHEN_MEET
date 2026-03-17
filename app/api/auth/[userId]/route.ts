import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update('whenmeet_salt_' + password).digest('hex');
}

/**
 * POST /api/auth/[userId]
 * 처음 사용: 비밀번호 등록
 * 이후: 비밀번호 검증
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const { password } = await request.json();

  if (!password) {
    return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 });
  }

  if (!isKvConfigured) {
    // 로컬 개발 환경: KV 없으면 통과
    return NextResponse.json({ success: true, isNew: false });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const passwordKey = `password:${userId}`;
    const storedHash = await kv.get<string>(passwordKey);
    const inputHash = hashPassword(password);

    if (!storedHash) {
      // 처음 사용 → 비밀번호 등록
      await kv.set(passwordKey, inputHash);
      return NextResponse.json({ success: true, isNew: true });
    }

    // 비밀번호 검증
    if (storedHash === inputHash) {
      return NextResponse.json({ success: true, isNew: false });
    }

    return NextResponse.json({ success: false, error: '비밀번호가 틀렸습니다.' }, { status: 401 });
  } catch (error) {
    console.error('[auth API] error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * PATCH /api/auth/[userId]
 * 비밀번호 변경: currentPassword 검증 후 newPassword로 교체
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 });
  }

  if (!isKvConfigured) {
    return NextResponse.json({ success: true });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const passwordKey = `password:${userId}`;
    const storedHash = await kv.get<string>(passwordKey);
    const currentHash = hashPassword(currentPassword);

    if (storedHash && storedHash !== currentHash) {
      return NextResponse.json({ success: false, error: '현재 비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    await kv.set(passwordKey, hashPassword(newPassword));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[auth PATCH] error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/[userId]
 * 계정 삭제: 비밀번호 검증 후 해당 userId의 모든 KV 데이터 제거
 * Body: { password }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const { password } = await request.json();

  if (!password) {
    return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 });
  }

  if (!isKvConfigured) {
    return NextResponse.json({ success: true });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const storedHash = await kv.get<string>(`password:${userId}`);

    if (!storedHash) {
      return NextResponse.json({ success: false, error: '계정을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (storedHash !== hashPassword(password)) {
      return NextResponse.json({ success: false, error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    await Promise.all([
      kv.del(`password:${userId}`),
      kv.del(`schedule:${userId}`),
      kv.del(`user:${userId}`),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[auth DELETE] error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
