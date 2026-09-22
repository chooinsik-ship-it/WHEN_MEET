import { NextRequest, NextResponse } from 'next/server';
import { requireSelf, requireSession } from '../../../lib/apiAuth';

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
  // 내 초대함만 조회 가능
  const { userId: targetId } = await params;
  const session = await requireSelf(request, targetId);
  if (!session.ok) return session.response;

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
  const { userId: targetId } = await params;
  const body = await request.json();

  // 단건 초대는 "남에게 보내는" 동작이라 로그인만 확인하고,
  // 목록 전체 저장(수락·거절 처리)은 본인만 할 수 있다.
  const session = body?.invitation
    ? await requireSession(request)
    : await requireSelf(request, targetId);
  if (!session.ok) return session.response;

  if (!isKvConfigured) {
    return NextResponse.json({ success: true });
  }

  try {
    const { kv } = await import('@vercel/kv');
    const { userId } = await params;
    const { invitation, invitations } = body;
    const key = `groupInvitations:${userId}`;

    if (invitation) {
      // 서버에서 덧붙인다 → 보내는 쪽이 상대 초대함을 통째로 덮어쓰지 않는다
      const existing = (await kv.get<{ groupId: string }[]>(key)) ?? [];
      if (!existing.some(inv => inv.groupId === invitation.groupId)) {
        await kv.set(key, [...existing, invitation]);
      }
      return NextResponse.json({ success: true });
    }

    await kv.set(key, invitations);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Group invitations save error:', error);
    return NextResponse.json({ error: 'Failed to save group invitations' }, { status: 500 });
  }
}
