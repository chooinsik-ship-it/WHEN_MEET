/**
 * Vercel KV 및 로컬 스토리지를 사용한 사용자별 시간표 관리
 */

const STORAGE_KEY_PREFIX = 'whenmeet_schedule_';

/**
 * 사용자 시간표 저장 (서버 + 로컬)
 * @param userId 사용자 ID
 * @param schedule 시간표 데이터
 */
export async function saveSchedule(userId: number, schedule: boolean[][]): Promise<void> {
  try {
    // 로컬 스토리지에 저장 (즉시 반영 + 오프라인 지원)
    const key = `${STORAGE_KEY_PREFIX}${userId}`;
    const data = JSON.stringify(schedule);
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, data);
    }

    // 서버에 저장
    const response = await fetch(`/api/schedule/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ schedule }),
    });

    if (!response.ok) {
      console.error('서버 저장 실패, 로컬만 사용');
    }
  } catch (error) {
    console.error('시간표 저장 실패:', error);
  }
}

/**
 * 사용자 시간표 불러오기 (서버 우선, 로컬 fallback)
 * @param userId 사용자 ID
 * @returns 저장된 시간표 또는 null
 */
export async function loadSchedule(userId: number): Promise<boolean[][] | null> {
  try {
    // 서버에서 먼저 불러오기 시도
    const response = await fetch(`/api/schedule/${userId}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.schedule && Array.isArray(data.schedule) && data.schedule.length === 7) {
        // 로컬에도 캐시
        if (typeof window !== 'undefined') {
          const key = `${STORAGE_KEY_PREFIX}${userId}`;
          localStorage.setItem(key, JSON.stringify(data.schedule));
        }
        return data.schedule as boolean[][];
      }
    }

    // 서버에 없으면 로컬 스토리지에서 불러오기
    if (typeof window !== 'undefined') {
      const key = `${STORAGE_KEY_PREFIX}${userId}`;
      const localData = localStorage.getItem(key);
      
      if (localData) {
        const schedule = JSON.parse(localData);
        if (Array.isArray(schedule) && schedule.length === 7) {
          return schedule as boolean[][];
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('시간표 불러오기 실패:', error);
    
    // 에러 시 로컬 fallback
    if (typeof window !== 'undefined') {
      const key = `${STORAGE_KEY_PREFIX}${userId}`;
      const localData = localStorage.getItem(key);
      if (localData) {
        const schedule = JSON.parse(localData);
        if (Array.isArray(schedule) && schedule.length === 7) {
          return schedule as boolean[][];
        }
      }
    }
    
    return null;
  }
}

/**
 * 사용자 시간표 삭제
 * @param userId 사용자 ID
 */
export function deleteSchedule(userId: number): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${userId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('시간표 삭제 실패:', error);
  }
}

/**
 * 모든 저장된 시간표 목록 가져오기
 * @returns 사용자 ID 배열
 */
export function getAllSavedUserIds(): number[] {
  try {
    const userIds: number[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const userId = parseInt(key.replace(STORAGE_KEY_PREFIX, ''));
        if (!isNaN(userId)) {
          userIds.push(userId);
        }
      }
    }
    
    return userIds;
  } catch (error) {
    console.error('저장된 사용자 목록 가져오기 실패:', error);
    return [];
  }
}

/**
 * 그룹 초대 인터페이스
 */
export interface GroupInvitation {
  groupId: string;
  groupName: string;
  creatorNickname: string;
  creatorId: number;
  members: string[];
  createdAt: string;
}

/**
 * 닉네임을 사용자 ID로 변환 (일관성 있는 해시 함수)
 */
export function nicknameToId(nickname: string): number {
  const hash = nickname.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return Math.abs(hash);
}

/**
 * 특정 사용자에게 그룹 초대 저장
 * @param userNickname 초대받을 사용자 닉네임
 * @param invitation 그룹 초대 정보
 */
export function saveGroupInvitation(userNickname: string, invitation: GroupInvitation): void {
  try {
    const userId = nicknameToId(userNickname);
    const key = `group_invitations_${userId}`;
    
    if (typeof window !== 'undefined') {
      const existingInvitations = localStorage.getItem(key);
      const invitations: GroupInvitation[] = existingInvitations 
        ? JSON.parse(existingInvitations) 
        : [];
      
      // 동일한 그룹 초대가 이미 있는지 확인
      const exists = invitations.some(inv => inv.groupId === invitation.groupId);
      if (!exists) {
        invitations.push(invitation);
        localStorage.setItem(key, JSON.stringify(invitations));
      }
    }
  } catch (error) {
    console.error('그룹 초대 저장 실패:', error);
  }
}

/**
 * 사용자의 대기 중인 그룹 초대 목록 불러오기
 * @param userId 사용자 ID
 * @returns 초대 목록
 */
export function loadPendingInvitations(userId: number): GroupInvitation[] {
  try {
    if (typeof window !== 'undefined') {
      const key = `group_invitations_${userId}`;
      const data = localStorage.getItem(key);
      
      if (data) {
        return JSON.parse(data) as GroupInvitation[];
      }
    }
    return [];
  } catch (error) {
    console.error('그룹 초대 불러오기 실패:', error);
    return [];
  }
}

/**
 * 특정 그룹 초대 삭제
 * @param userId 사용자 ID
 * @param groupId 그룹 ID
 */
export function removeGroupInvitation(userId: number, groupId: string): void {
  try {
    if (typeof window !== 'undefined') {
      const key = `group_invitations_${userId}`;
      const data = localStorage.getItem(key);
      
      if (data) {
        const invitations: GroupInvitation[] = JSON.parse(data);
        const filtered = invitations.filter(inv => inv.groupId !== groupId);
        
        if (filtered.length > 0) {
          localStorage.setItem(key, JSON.stringify(filtered));
        } else {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.error('그룹 초대 삭제 실패:', error);
  }
}
