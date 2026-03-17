import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const isKvConfigured =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update('whenmeet_salt_' + password).digest('hex');
}

/**
 * POST /api/rename
 * 닉네임 변경: 기존 userId의 모든 데이터를 newUserId로 이전
 * Body: { oldUserId, newUserId, password }
 */
export async function POST(request: NextRequest) {
  const { oldUserId, newUserId, password } = await request.json();

  if (!oldUserId || !newUserId || !password) {
    return NextResponse.json({ success: false, error: '필수 값이 누락되었습니다.' }, { status: 400 });
  }

  if (oldUserId === newUserId) {
    return NextResponse.json({ success: false, error: '현재 닉네임과 동일합니다.' }, { status: 400 });
  }

  if (!isKvConfigured) {
    return NextResponse.json({ success: true });
  }

  try {
    const { kv } = await import('@vercel/kv');

    // 1. 비밀번호 검증
    const storedHash = await kv.get<string>(`password:${oldUserId}`);
    if (!storedHash) {
      return NextResponse.json({ success: false, error: '기존 계정을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (storedHash !== hashPassword(password)) {
      return NextResponse.json({ success: false, error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    // 2. 새 닉네임 ID가 이미 존재하는지 확인
    const existingPassword = await kv.get<string>(`password:${newUserId}`);
    if (existingPassword) {
      return NextResponse.json({ success: false, error: '이미 사용 중인 닉네임입니다.' }, { status: 409 });
    }

    // 3. 모든 데이터를 새 ID로 복사
    const [schedule, userData] = await Promise.all([
      kv.get(`schedule:${oldUserId}`),
      kv.get(`user:${oldUserId}`),
    ]);

    await Promise.all([
      kv.set(`password:${newUserId}`, storedHash),
      schedule !== null ? kv.set(`schedule:${newUserId}`, schedule) : Promise.resolve(),
      userData !== null ? kv.set(`user:${newUserId}`, userData) : Promise.resolve(),
    ]);

    // 4. 기존 데이터 삭제
    await Promise.all([
      kv.del(`password:${oldUserId}`),
      kv.del(`schedule:${oldUserId}`),
      kv.del(`user:${oldUserId}`),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[rename API] error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
