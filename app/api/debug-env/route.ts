import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    KV_URL: !!process.env.KV_URL,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    // 값 앞 10자만 노출 (보안)
    KV_REST_API_URL_preview: process.env.KV_REST_API_URL?.slice(0, 20) ?? 'NOT SET',
  });
}
