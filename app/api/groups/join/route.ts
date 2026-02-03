import { NextResponse } from 'next/server';

// Upstash Redis KV 클라이언트
let kv: any = null;

async function getKVClient() {
  if (kv) return kv;
  
  try {
    const { kv: kvClient } = await import('@vercel/kv');
    kv = kvClient;
    return kv;
  } catch (error) {
    console.error('KV client initialization failed:', error);
    return null;
  }
}

/**
 * POST /api/groups/join - 그룹 참여
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { groupId, nickname, accept } = body;

    if (!groupId || !nickname) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const kvClient = await getKVClient();
    
    if (!kvClient) {
      return NextResponse.json(
        { error: 'Storage service unavailable' },
        { status: 503 }
      );
    }

    // 초대 목록에서 제거
    const invitationsKey = `invitations:${nickname}`;
    const invitationIds = await kvClient.get(invitationsKey) || [];
    const parsedIds = typeof invitationIds === 'string' 
      ? JSON.parse(invitationIds) 
      : invitationIds;
    
    const updatedInvitations = parsedIds.filter((id: string) => id !== groupId);
    await kvClient.set(invitationsKey, JSON.stringify(updatedInvitations));

    if (accept) {
      // 그룹의 acceptedMembers에 추가
      const groupData = await kvClient.get(`group:${groupId}`);
      if (groupData) {
        const group = typeof groupData === 'string' ? JSON.parse(groupData) : groupData;
        
        if (!group.acceptedMembers) {
          group.acceptedMembers = [group.creator];
        }
        
        if (!group.acceptedMembers.includes(nickname)) {
          group.acceptedMembers.push(nickname);
          await kvClient.set(`group:${groupId}`, JSON.stringify(group));
        }

        return NextResponse.json({ success: true, group });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to join group:', error);
    return NextResponse.json(
      { error: 'Failed to join group' },
      { status: 500 }
    );
  }
}
