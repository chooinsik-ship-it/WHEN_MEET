import { NextRequest, NextResponse } from 'next/server';
import { requireSelf, requireSession, sessionNickname } from '../../../lib/apiAuth';

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
  // 알림은 본인 것만 조회 가능
  const { userId: targetId } = await params;
  const session = await requireSelf(request, targetId);
  if (!session.ok) return session.response;

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
  const { userId: targetId } = await params;
  const body = await request.json();

  // 단건 추가는 "남에게 보내는" 동작이므로 로그인만 확인하고,
  // 목록 전체 저장(읽음 처리·삭제)은 본인만 할 수 있다.
  const session = body?.notification
    ? await requireSession(request)
    : await requireSelf(request, targetId);
  if (!session.ok) return session.response;

  if (!isKvConfigured) {
    return NextResponse.json({ success: true });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const { notification, notifications } = body;
    const key = `notifications:${userId}`;

    if (notification) {
      // 발신자 위조 방지: 표시되는 보낸 사람을 서버가 세션 기준으로 덮어쓴다
      const realNickname = await sessionNickname(session.userId);
      if (realNickname && notification.fromNickname) {
        notification.fromNickname = realNickname;
      }
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
