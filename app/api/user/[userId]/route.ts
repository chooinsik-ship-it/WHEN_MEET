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
    console.warn('[user API] KV not configured - returning null');
    return NextResponse.json({ user: null });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    console.log('[user API] GET user:', userId);
    const user = await kv.get(`user:${userId}`);
    console.log('[user API] GET result:', JSON.stringify(user));

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[user API] GET error:', error);
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
    console.warn('[user API] KV not configured - skip save');
    return NextResponse.json({ success: true });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const body = await request.json();
    console.log('[user API] POST user:', userId, JSON.stringify(body));

    await kv.set(`user:${userId}`, body);
    console.log('[user API] POST saved successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[user API] POST error:', error);
    return NextResponse.json({ error: 'Failed to save user' }, { status: 500 });
  }
}
