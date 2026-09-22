import { NextRequest, NextResponse } from 'next/server';
import { requireSelf, requireSession } from '../../../lib/apiAuth';

const isKvConfigured =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/**
 * GET /api/schedule/[userId]
 * 특정 사용자의 시간표 가져오기
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // 로그인한 사용자만 조회 가능 (친구 시간표 비교 때문에 타인 조회는 허용)
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  if (!isKvConfigured) {
    return NextResponse.json({ schedule: null });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
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
  { params }: { params: Promise<{ userId: string }> }
) {
  // 쓰기는 본인 데이터만
  const { userId: targetId } = await params;
  const session = await requireSelf(request, targetId);
  if (!session.ok) return session.response;

  if (!isKvConfigured) {
    return NextResponse.json({ success: true });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const { schedule } = await request.json();
    
    // KV에 저장 (만료 없음)
    await kv.set(`schedule:${userId}`, schedule);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Schedule save error:', error);
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
  }
}
