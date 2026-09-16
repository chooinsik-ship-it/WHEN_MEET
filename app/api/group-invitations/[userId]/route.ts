import { NextRequest, NextResponse } from 'next/server';

const isKvConfigured =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/**
 * GET /api/group-invitations/[userId]
 * 특정 사용자의 대기 중인 그룹 초대 목록 가져오기
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!isKvConfigured) {
    return NextResponse.json({ invitations: [] });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const invitations = await kv.get(`groupInvitations:${userId}`);

    return NextResponse.json({ invitations: invitations ?? [] });
  } catch (error) {
    console.error('Group invitations fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch group invitations' }, { status: 500 });
  }
}

/**
 * POST /api/group-invitations/[userId]
 * 그룹 초대 목록 전체 저장 (추가/삭제 모두 클라이언트에서 배열을 만들어 덮어씀)
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
    const { invitations } = await request.json();

    await kv.set(`groupInvitations:${userId}`, invitations);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Group invitations save error:', error);
    return NextResponse.json({ error: 'Failed to save group invitations' }, { status: 500 });
  }
}
