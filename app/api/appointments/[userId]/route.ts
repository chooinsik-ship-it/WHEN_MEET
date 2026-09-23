import { NextResponse, type NextRequest } from 'next/server';
import { requireSelf, requireSession, sessionNickname } from '../../../lib/apiAuth';

const isKvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

interface Appointment {
  id: string;
  participants?: string[];
  [key: string]: unknown;
}

const key = (userId: string | number) => `appointments:${userId}`;

async function readList(userId: string | number): Promise<Appointment[]> {
  const { kv } = await import('@vercel/kv');
  return (await kv.get<Appointment[]>(key(userId))) ?? [];
}

async function writeList(userId: string | number, list: Appointment[]): Promise<void> {
  const { kv } = await import('@vercel/kv');
  await kv.set(key(userId), list);
}

/**
 * GET /api/appointments/[userId]  내 약속 목록
 *
 * 약속이 localStorage 에만 있어서 다른 기기로 로그인하면 약속이 보이지 않았고,
 * 수락/거절 상태도 참여자끼리 어긋났다. 이제 서버(KV)가 원본이다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = await requireSelf(request, userId);
  if (!session.ok) return session.response;

  if (!isKvConfigured) return NextResponse.json({ appointments: [] });
  return NextResponse.json({ appointments: await readList(userId) });
}

/** POST — 내 약속 목록 전체 저장 (로컬 데이터 이전 포함) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const session = await requireSelf(request, userId);
  if (!session.ok) return session.response;

  const { appointments } = await request.json();
  if (!Array.isArray(appointments)) {
    return NextResponse.json({ error: 'appointments 배열이 필요합니다.' }, { status: 422 });
  }

  if (!isKvConfigured) return NextResponse.json({ success: true });

  await writeList(userId, appointments);
  return NextResponse.json({ success: true });
}

/**
 * PATCH — 참여자의 약속 목록에 1건 추가/수정하거나 삭제한다.
 * body: { appointment } | { removeId }
 *
 * 남의 목록을 건드리므로 아래를 모두 확인한다.
 *  - 요청자가 그 약속의 참여자여야 한다
 *  - 새로 넣는 경우, 대상이 요청자의 친구이거나 이미 그 약속을 가지고 있어야 한다
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetId } = await params;
  const session = await requireSession(request);
  if (!session.ok) return session.response;

  const { appointment, removeId } = await request.json();
  if (!appointment && !removeId) {
    return NextResponse.json({ error: 'appointment 또는 removeId 가 필요합니다.' }, { status: 422 });
  }

  if (!isKvConfigured) return NextResponse.json({ success: true });

  const myNickname = await sessionNickname(session.userId);
  if (!myNickname) {
    return NextResponse.json({ error: '내 프로필을 찾을 수 없습니다.' }, { status: 409 });
  }

  const { kv } = await import('@vercel/kv');
  const list = await readList(targetId);

  if (removeId) {
    const existing = list.find(a => a.id === removeId);
    // 대상이 가지고 있지 않으면 할 일이 없다
    if (!existing) return NextResponse.json({ success: true });

    if (!(existing.participants ?? []).includes(myNickname)) {
      return NextResponse.json({ error: '이 약속의 참여자가 아닙니다.' }, { status: 403 });
    }
    await writeList(targetId, list.filter(a => a.id !== removeId));
    return NextResponse.json({ success: true });
  }

  const participants: string[] = appointment.participants ?? [];
  if (!participants.includes(myNickname)) {
    return NextResponse.json({ error: '이 약속의 참여자가 아닙니다.' }, { status: 403 });
  }

  const already = list.some(a => a.id === appointment.id);
  if (!already && String(session.userId) !== String(targetId)) {
    // 모르는 사람에게 약속을 밀어 넣지 못하도록 친구 관계를 확인
    const myFriends = (await kv.get<string[]>(`friends:${session.userId}`)) ?? [];
    const targetUser = await kv.get<{ nickname?: string }>(`user:${targetId}`);
    const targetNickname = targetUser?.nickname;

    if (!targetNickname || !myFriends.includes(targetNickname)) {
      return NextResponse.json(
        { error: '친구에게만 약속을 보낼 수 있습니다.', code: 'NOT_FRIEND' },
        { status: 403 }
      );
    }
  }

  const next = already
    ? list.map(a => (a.id === appointment.id ? appointment : a))
    : [...list, appointment];

  await writeList(targetId, next);
  return NextResponse.json({ success: true });
}
