import { NextRequest, NextResponse } from 'next/server';

const isKvConfigured =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/**
 * GET /api/keep-alive
 * Upstash 무료 DB는 14일간 명령이 없으면 자동 삭제된다.
 * Vercel Cron이 매일 한 번 호출해 비활성 타이머를 리셋한다. (vercel.json)
 */
export async function GET(request: NextRequest) {
  // CRON_SECRET이 설정돼 있으면 Vercel Cron 요청만 허용
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isKvConfigured) {
    return NextResponse.json({ ok: true, skipped: 'KV not configured' });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const pingedAt = new Date().toISOString();

    // 읽기/쓰기 각각 1회 — 어느 쪽이든 명령으로 집계되어 비활성 타이머가 초기화된다
    await kv.set('keepalive:last-ping', pingedAt);
    const stored = await kv.get<string>('keepalive:last-ping');

    return NextResponse.json({ ok: true, pingedAt: stored });
  } catch (error) {
    console.error('Keep-alive error:', error);
    return NextResponse.json({ error: 'Failed to ping KV' }, { status: 500 });
  }
}
