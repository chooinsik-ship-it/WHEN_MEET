import { NextRequest, NextResponse } from 'next/server';

const isKvConfigured =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/**
 * GET /api/date-schedule/[userId]
 * 특정 사용자의 날짜별 일정 가져오기
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!isKvConfigured) {
    return NextResponse.json({ dateSchedule: null });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const dateSchedule = await kv.get(`dateSchedule:${userId}`);

    return NextResponse.json({ dateSchedule });
  } catch (error) {
    console.error('Date schedule fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch date schedule' }, { status: 500 });
  }
}

/**
 * POST /api/date-schedule/[userId]
 * 날짜별 일정 저장
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
    const { dateSchedule } = await request.json();

    await kv.set(`dateSchedule:${userId}`, dateSchedule);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Date schedule save error:', error);
    return NextResponse.json({ error: 'Failed to save date schedule' }, { status: 500 });
  }
}
