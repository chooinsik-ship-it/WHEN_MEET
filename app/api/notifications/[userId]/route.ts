import { NextRequest, NextResponse } from 'next/server';

const isKvConfigured =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/**
 * GET /api/notifications/[userId]
 * 특정 사용자의 알림 목록 가져오기
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!isKvConfigured) {
    return NextResponse.json({ notifications: [] });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const notifications = await kv.get(`notifications:${userId}`);

    return NextResponse.json({ notifications: notifications ?? [] });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

/**
 * POST /api/notifications/[userId]
 * - { notification }  : 알림 1건 추가. 서버에서 기존 목록을 읽어 덧붙인다.
 *   (보내는 쪽이 받는 사람의 배열 전체를 덮어쓰면 그 사이 도착한 알림이 사라지므로)
 * - { notifications } : 목록 전체 저장 (읽음 처리/삭제용)
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
    const { notification, notifications } = await request.json();
    const key = `notifications:${userId}`;

    if (notification) {
      const existing = (await kv.get<{ id: string }[]>(key)) ?? [];
      // 재전송으로 같은 알림이 두 번 쌓이지 않도록
      if (!existing.some(n => n.id === notification.id)) {
        await kv.set(key, [notification, ...existing]);
      }
      return NextResponse.json({ success: true });
    }

    await kv.set(key, notifications);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notifications save error:', error);
    return NextResponse.json({ error: 'Failed to save notifications' }, { status: 500 });
  }
}
