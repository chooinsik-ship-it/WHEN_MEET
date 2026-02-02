import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/schedule/[userId]
 * 특정 사용자의 시간표 가져오기
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const schedule = await kv.get(`schedule:${userId}`);
    
    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Schedule fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

/**
 * POST /api/schedule/[userId]
 * 시간표 저장
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;
    const { schedule } = await request.json();
    
    // KV에 저장 (만료 없음)
    await kv.set(`schedule:${userId}`, schedule);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule save error:', error);
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
  }
}
