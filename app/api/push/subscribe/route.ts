import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '../../../lib/apiAuth';
import { countSubscriptions, removeSubscription, saveSubscription } from '../../../lib/push';

/**
 * POST   /api/push/subscribe  구독 등록 (로그인한 본인 기기)
 * DELETE /api/push/subscribe  구독 해제
 * GET    /api/push/subscribe  현재 등록된 기기 수
 */
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  try {
    const { subscription } = await request.json();

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: '구독 정보가 올바르지 않습니다.' }, { status: 422 });
    }

    await saveSubscription(session.userId, {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[push subscribe] error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  try {
    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint 가 필요합니다.' }, { status: 422 });
    }
    await removeSubscription(session.userId, endpoint);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[push unsubscribe] error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  return NextResponse.json({ devices: await countSubscriptions(session.userId) });
}
