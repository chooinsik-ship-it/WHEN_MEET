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
 * POST /api/groups - 그룹 생성
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, creator, creatorId, members, createdAt } = body;

    if (!id || !name || !creator || !members) {
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

    // 그룹 데이터 저장
    const groupData = {
      id,
      name,
      creator,
      creatorId,
      members,
      createdAt,
      acceptedMembers: [creator], // 생성자는 자동 참여
    };

    // Redis에 그룹 저장
    await kvClient.set(`group:${id}`, JSON.stringify(groupData));

    // 각 멤버별 초대 목록에 추가
    for (const memberNickname of members) {
      if (memberNickname !== creator) {
        const invitationsKey = `invitations:${memberNickname}`;
        const existingInvitations = await kvClient.get(invitationsKey) || [];
        
        // 중복 확인
        if (!existingInvitations.includes(id)) {
          await kvClient.set(invitationsKey, JSON.stringify([...existingInvitations, id]));
        }
      }
    }

    return NextResponse.json({ success: true, group: groupData });
  } catch (error) {
    console.error('Failed to create group:', error);
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/groups - 내가 참여한 그룹 목록 조회
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
      return NextResponse.json({ groups: [] });
    }

    // 모든 그룹 키 조회
    const keys = await kvClient.keys('group:*');
    const myGroups = [];

    for (const key of keys) {
      const groupData = await kvClient.get(key);
      if (groupData) {
        const group = typeof groupData === 'string' ? JSON.parse(groupData) : groupData;
        
        // 내가 수락한 그룹인지 확인
        if (group.acceptedMembers && group.acceptedMembers.includes(nickname)) {
          myGroups.push(group);
        }
      }
    }

    return NextResponse.json({ groups: myGroups });
  } catch (error) {
    console.error('Failed to fetch groups:', error);
    return NextResponse.json({ groups: [] });
  }
}
