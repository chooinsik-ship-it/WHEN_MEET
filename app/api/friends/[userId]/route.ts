import { NextResponse, type NextRequest } from 'next/server';
import { requireSelf } from '../../../lib/apiAuth';

const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

/**
 * GET  /api/friends/[userId]  내 친구 목록
 * POST /api/friends/[userId]  내 친구 목록 저장 (기기 간 동기화 · 로컬 데이터 이전용)
 *
 * 친구 관계가 localStorage 에만 있어서 다른 기기로 로그인하면 목록이 비어 있었다.
 * 이제 서버(KV)가 원본이고 localStorage 는 캐시 역할만 한다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = await requireSelf(request, userId);
  if (!session.ok) return session.response;

  if (!isKvConfigured) return NextResponse.json({ friends: [] });

  const { kv } = await import('@vercel/kv');
  const friends = (await kv.get<string[]>(`friends:${userId}`)) ?? [];
  return NextResponse.json({ friends });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = await requireSelf(request, userId);
  if (!session.ok) return session.response;

  const { friends } = await request.json();
  if (!Array.isArray(friends)) {
    return NextResponse.json({ error: 'friends 배열이 필요합니다.' }, { status: 422 });
  }

  if (!isKvConfigured) return NextResponse.json({ success: true });

  const { kv } = await import('@vercel/kv');
  const cleaned = [...new Set(friends.filter((f): f is string => typeof f === 'string' && f.trim().length > 0))];
  await kv.set(`friends:${userId}`, cleaned);

  return NextResponse.json({ success: true, friends: cleaned });
}
