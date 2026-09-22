import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '../../lib/apiAuth';

/**
 * GET /api/debug-env
 * 저장소 설정 여부만 확인하는 진단용 엔드포인트.
 *
 * 예전에는 누구나 호출할 수 있었고 DB 호스트 앞부분까지 노출했다.
 * 지금은 로그인한 사용자만 접근할 수 있고, 값은 일절 내보내지 않는다.
 */
export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  return NextResponse.json({
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    KV_URL: !!process.env.KV_URL,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}
