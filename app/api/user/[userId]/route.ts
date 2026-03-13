import { NextRequest, NextResponse } from 'next/server';

const isKvConfigured =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/**
 * GET /api/user/[userId]
 * 특정 사용자의 정보(거주지 등) 가져오기
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!isKvConfigured) {
    return NextResponse.json({ user: null });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const user = await kv.get(`user:${userId}`);

    return NextResponse.json({ user });
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * POST /api/user/[userId]
 * 사용자 정보(거주지 등) 저장
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!isKvConfigured) {
    return NextResponse.json({ success: true });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const body = await request.json();

    await kv.set(`user:${userId}`, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User save error:', error);
    return NextResponse.json({ error: 'Failed to save user' }, { status: 500 });
  }
}
