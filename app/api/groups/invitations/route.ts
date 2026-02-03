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
 * GET /api/groups/invitations - 내 초대 목록 조회
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get('nickname');

    if (!nickname) {
      return NextResponse.json(
        { error: 'Nickname is required' },
        { status: 400 }
      );
    }

    const kvClient = await getKVClient();
    
    if (!kvClient) {
      return NextResponse.json({ invitations: [] });
    }

    // 초대 목록 조회
    const invitationsKey = `invitations:${nickname}`;
    const invitationIds = await kvClient.get(invitationsKey) || [];
    
    const parsedIds = typeof invitationIds === 'string' 
      ? JSON.parse(invitationIds) 
      : invitationIds;

    const invitations = [];

    for (const groupId of parsedIds) {
      const groupData = await kvClient.get(`group:${groupId}`);
      if (groupData) {
        const group = typeof groupData === 'string' ? JSON.parse(groupData) : groupData;
        
        // 이미 수락한 그룹은 제외
        if (!group.acceptedMembers || !group.acceptedMembers.includes(nickname)) {
          invitations.push({
            id: group.id,
            name: group.name,
            creator: group.creator,
            members: group.members,
            createdAt: group.createdAt,
          });
        }
      }
    }

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Failed to fetch invitations:', error);
    return NextResponse.json({ invitations: [] });
  }
}
