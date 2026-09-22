import { NextResponse } from 'next/server';
import { getPublicKey } from '../../../lib/push';

/**
 * GET /api/push/key
 * 브라우저가 푸시를 구독할 때 필요한 VAPID 공개키
 */
export async function GET() {
  try {
    const publicKey = await getPublicKey();
    if (!publicKey) {
      return NextResponse.json({ error: '푸시가 설정되지 않았습니다.' }, { status: 503 });
    }
    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error('[push key] error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
