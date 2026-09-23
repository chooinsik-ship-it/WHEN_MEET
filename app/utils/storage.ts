/**
 * Vercel KV 및 로컬 스토리지를 사용한 사용자별 시간표 관리
 */

const STORAGE_KEY_PREFIX = 'whenmeet_schedule_';

/**
 * API 호출 공통 래퍼
 * 세션이 만료(401)되면 한 번만 안내하고 로그인 화면으로 돌려보낸다.
 * (예전 방식으로 로그인해 세션 쿠키가 없는 사용자도 여기서 걸린다)
 */
let sessionExpiredHandled = false;

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401 && typeof window !== 'undefined' && !sessionExpiredHandled) {
    sessionExpiredHandled = true;
    localStorage.removeItem('currentUser');
    alert('로그인이 만료되었어요. 다시 로그인해주세요.');
    window.location.reload();
  }

  return response;
}

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
    const response = await apiFetch(`/api/schedule/${userId}`, {
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
    const response = await apiFetch(`/api/schedule/${userId}`);
    
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
 * 날짜별 일정 (YYYY-MM-DD -> 그 날 일정 있음 여부)
 */
export type DateScheduleMap = Record<string, boolean>;

const DATE_SCHEDULE_STORAGE_KEY_PREFIX = 'whenmeet_date_schedule_';

/**
 * 사용자 날짜별 일정 저장 (서버 + 로컬)
 */
export async function saveDateSchedule(userId: number, dateSchedule: DateScheduleMap): Promise<void> {
  try {
    const key = `${DATE_SCHEDULE_STORAGE_KEY_PREFIX}${userId}`;
    const data = JSON.stringify(dateSchedule);
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, data);
    }

    const response = await apiFetch(`/api/date-schedule/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateSchedule }),
    });

    if (!response.ok) {
      console.error('날짜별 일정 서버 저장 실패, 로컬만 사용');
    }
  } catch (error) {
    console.error('날짜별 일정 저장 실패:', error);
  }
}

/**
 * 사용자 날짜별 일정 불러오기 (서버 우선, 로컬 fallback)
 */
export async function loadDateSchedule(userId: number): Promise<DateScheduleMap | null> {
  try {
    const response = await apiFetch(`/api/date-schedule/${userId}`);

    if (response.ok) {
      const data = await response.json();
      if (data.dateSchedule && typeof data.dateSchedule === 'object') {
        if (typeof window !== 'undefined') {
          const key = `${DATE_SCHEDULE_STORAGE_KEY_PREFIX}${userId}`;
          localStorage.setItem(key, JSON.stringify(data.dateSchedule));
        }
        return data.dateSchedule as DateScheduleMap;
      }
    }

    if (typeof window !== 'undefined') {
      const key = `${DATE_SCHEDULE_STORAGE_KEY_PREFIX}${userId}`;
      const localData = localStorage.getItem(key);
      if (localData) {
        return JSON.parse(localData) as DateScheduleMap;
      }
    }

    return null;
  } catch (error) {
    console.error('날짜별 일정 불러오기 실패:', error);

    if (typeof window !== 'undefined') {
      const key = `${DATE_SCHEDULE_STORAGE_KEY_PREFIX}${userId}`;
      const localData = localStorage.getItem(key);
      if (localData) {
        return JSON.parse(localData) as DateScheduleMap;
      }
    }

    return null;
  }
}

/**
 * 사용자 정보 저장 (서버 + 로컬)
 */
export async function saveUser(userId: number, userData: object): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`user_${userId}`, JSON.stringify(userData));
    }
    const response = await apiFetch(`/api/user/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      console.error('saveUser 서버 응답 오류:', response.status, await response.text());
    }
  } catch (error) {
    console.error('사용자 저장 실패:', error);
  }
}

/**
 * 사용자 정보 불러오기 (서버 우선, 로컬 fallback)
 */
export async function loadUser(userId: number): Promise<Record<string, unknown> | null> {
  try {
    const response = await apiFetch(`/api/user/${userId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.user) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`user_${userId}`, JSON.stringify(data.user));
        }
        return data.user as Record<string, unknown>;
      }
    }
  } catch {
    // 서버 실패 시 로컬 fallback
  }

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(`user_${userId}`);
    if (local) return JSON.parse(local);
  }
  return null;
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

/* ------------------------------------------------------------------ 친구 */

const FRIENDS_KEY_PREFIX = 'friends_';

/**
 * 친구 목록 불러오기 (서버가 원본, localStorage 는 캐시)
 *
 * 예전에는 localStorage 에만 있어서 다른 기기로 로그인하면 친구가 사라졌다.
 * 서버에 목록이 없고 로컬에만 있으면 이번 로그인에 자동으로 이전한다.
 */
export async function loadFriendNicknames(userId: number): Promise<string[]> {
  const key = `${FRIENDS_KEY_PREFIX}${userId}`;
  const local: string[] =
    typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(key) || '[]') : [];

  try {
    const response = await apiFetch(`/api/friends/${userId}`);
    if (response.ok) {
      const data = await response.json();
      const server: string[] = Array.isArray(data.friends) ? data.friends : [];

      // 서버가 비어 있고 로컬에만 있으면 기존 데이터를 서버로 이전
      if (server.length === 0 && local.length > 0) {
        await saveFriendNicknames(userId, local);
        return local;
      }

      if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(server));
      return server;
    }
  } catch (error) {
    console.error('친구 목록 불러오기 실패:', error);
  }

  return local;
}

/** 내 친구 목록 저장 (서버 + 로컬) */
export async function saveFriendNicknames(userId: number, nicknames: string[]): Promise<void> {
  const unique = [...new Set(nicknames)];
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${FRIENDS_KEY_PREFIX}${userId}`, JSON.stringify(unique));
  }
  try {
    await apiFetch(`/api/friends/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friends: unique }),
    });
  } catch (error) {
    console.error('친구 목록 저장 실패:', error);
  }
}

/**
 * 친구 요청 수락 — 서버가 양쪽 목록에 서로를 추가한다.
 * (상대가 다른 기기에 있어도 반영된다)
 */
export async function linkFriend(partnerNickname: string): Promise<boolean> {
  try {
    const response = await apiFetch('/api/friends/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerNickname }),
    });
    if (!response.ok) {
      console.error('친구 연결 실패:', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('친구 연결 실패:', error);
    return false;
  }
}

/** 친구 삭제 — 서버가 양쪽 목록에서 제거한다 */
export async function unlinkFriend(partnerNickname: string): Promise<void> {
  try {
    await apiFetch('/api/friends/link', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerNickname }),
    });
  } catch (error) {
    console.error('친구 삭제 실패:', error);
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
  /** 초대한 사람이 수신자의 친구가 아닐 때 true */
  fromNonFriend?: boolean;
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

const GROUP_INVITATIONS_KEY_PREFIX = 'group_invitations_';

/**
 * 사용자의 대기 중인 그룹 초대 목록 불러오기 (서버 우선, 로컬 fallback)
 * @param userId 사용자 ID
 * @returns 초대 목록
 */
export async function loadPendingInvitations(userId: number): Promise<GroupInvitation[]> {
  const key = `${GROUP_INVITATIONS_KEY_PREFIX}${userId}`;
  try {
    const response = await apiFetch(`/api/group-invitations/${userId}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.invitations)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(data.invitations));
        }
        return data.invitations as GroupInvitation[];
      }
    }
  } catch (error) {
    console.error('그룹 초대 불러오기 실패:', error);
  }

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(key);
    if (local) return JSON.parse(local) as GroupInvitation[];
  }
  return [];
}

/**
 * 사용자의 그룹 초대 목록 전체 저장 (서버 + 로컬)
 */
async function saveAllGroupInvitations(userId: number, invitations: GroupInvitation[]): Promise<void> {
  try {
    const key = `${GROUP_INVITATIONS_KEY_PREFIX}${userId}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(invitations));
    }
    await apiFetch(`/api/group-invitations/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitations }),
    });
  } catch (error) {
    console.error('그룹 초대 저장 실패:', error);
  }
}

/**
 * 특정 사용자에게 그룹 초대 저장
 * @param userNickname 초대받을 사용자 닉네임
 * @param invitation 그룹 초대 정보
 */
export async function saveGroupInvitation(userNickname: string, invitation: GroupInvitation): Promise<boolean> {
  const userId = nicknameToId(userNickname);

  try {
    // 서버가 상대 초대함에 덧붙인다 (상대 목록을 통째로 덮어쓰지 않음)
    const response = await apiFetch(`/api/group-invitations/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation }),
    });
    if (!response.ok) {
      console.error('그룹 초대 전송 실패:', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('그룹 초대 전송 실패:', error);
    return false;
  }
}

/**
 * 특정 그룹 초대 삭제
 * @param userId 사용자 ID
 * @param groupId 그룹 ID
 */
export async function removeGroupInvitation(userId: number, groupId: string): Promise<void> {
  const existing = await loadPendingInvitations(userId);
  await saveAllGroupInvitations(userId, existing.filter(inv => inv.groupId !== groupId));
}

/**
 * 확정된 약속 인터페이스
 */
export interface Appointment {
  id: string;
  name: string;
  day: number;
  startHour: number;
  endHour: number;
  participants: string[];
  acceptedBy?: string[]; // 수락한 참여자 목록
  createdAt: string;
  status?: 'pending' | 'confirmed'; // 전원 수락 시 confirmed
  place?: string; // 약속 장소 (선택)
}

/**
 * 알림 인터페이스
 */
export interface AppNotification {
  id: string;
  type: 'appointment_cancelled' | 'appointment_invite' | 'appointment_accepted' | 'appointment_rejected' | 'friend_request' | 'friend_accepted' | 'friend_rejected' | 'friend_removed';
  message: string;
  appointment?: Appointment;
  /** 친구 요청 발신자 닉네임 */
  fromNickname?: string;
  createdAt: string;
  read: boolean;
}

const NOTIFICATIONS_KEY_PREFIX = 'notifications_';

/**
 * 사용자 알림 목록 불러오기 (서버 우선, 로컬 fallback)
 */
export async function loadNotifications(userId: number): Promise<AppNotification[]> {
  const key = `${NOTIFICATIONS_KEY_PREFIX}${userId}`;
  try {
    const response = await apiFetch(`/api/notifications/${userId}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.notifications)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(data.notifications));
        }
        return data.notifications as AppNotification[];
      }
    }
  } catch (error) {
    console.error('알림 불러오기 실패:', error);
  }

  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(key);
    if (local) return JSON.parse(local) as AppNotification[];
  }
  return [];
}

/**
 * 사용자 알림 목록 전체 저장 (서버 + 로컬)
 */
export async function saveAllNotifications(userId: number, notifications: AppNotification[]): Promise<void> {
  try {
    const key = `${NOTIFICATIONS_KEY_PREFIX}${userId}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(notifications));
    }
    await apiFetch(`/api/notifications/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications }),
    });
  } catch (error) {
    console.error('알림 저장 실패:', error);
  }
}

/**
 * 특정 사용자에게 알림 1건 전송
 * 서버에서 기존 목록에 덧붙이므로, 상대가 그 사이 받은 알림을 덮어쓰지 않는다.
 * @returns 서버 저장 성공 여부 (호출한 쪽에서 성공/실패를 구분해야 할 때 사용)
 */
export async function saveNotification(userNickname: string, notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>): Promise<boolean> {
  const userId = nicknameToId(userNickname);
  const newNotification: AppNotification = {
    ...notification,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await apiFetch(`/api/notifications/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification: newNotification }),
    });

    if (!response.ok) {
      console.error('알림 전송 실패:', response.status);
      return false;
    }

    // 같은 브라우저에서 수신자로 로그인하는 경우를 위한 로컬 캐시 갱신
    if (typeof window !== 'undefined') {
      const key = `${NOTIFICATIONS_KEY_PREFIX}${userId}`;
      const local: AppNotification[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([newNotification, ...local]));
    }

    return true;
  } catch (error) {
    console.error('알림 전송 실패:', error);
    return false;
  }
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationsRead(userId: number): Promise<void> {
  const existing = await loadNotifications(userId);
  await saveAllNotifications(userId, existing.map(n => ({ ...n, read: true })));
}

/**
 * 알림 단건 삭제
 */
export async function removeNotification(userId: number, notificationId: string): Promise<void> {
  const existing = await loadNotifications(userId);
  await saveAllNotifications(userId, existing.filter(n => n.id !== notificationId));
}

/* ------------------------------------------------------------------ 약속 */

const APPOINTMENTS_KEY_PREFIX = 'appointments_';

/**
 * 약속 목록 불러오기 (서버가 원본, localStorage 는 캐시)
 * 서버가 비어 있고 로컬에만 있으면 이번 로그인에 자동으로 이전한다.
 */
export async function loadAppointments(userId: number): Promise<Appointment[]> {
  const key = `${APPOINTMENTS_KEY_PREFIX}${userId}`;
  const local: Appointment[] =
    typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(key) || '[]') : [];

  try {
    const response = await apiFetch(`/api/appointments/${userId}`);
    if (response.ok) {
      const data = await response.json();
      const server: Appointment[] = Array.isArray(data.appointments) ? data.appointments : [];

      if (server.length === 0 && local.length > 0) {
        await saveMyAppointments(userId, local);
        return local;
      }

      if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(server));
      return server;
    }
  } catch (error) {
    console.error('약속 불러오기 실패:', error);
  }

  return local;
}

/** 내 약속 목록 전체 저장 (서버 + 로컬) */
export async function saveMyAppointments(userId: number, list: Appointment[]): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${APPOINTMENTS_KEY_PREFIX}${userId}`, JSON.stringify(list));
  }
  try {
    await apiFetch(`/api/appointments/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointments: list }),
    });
  } catch (error) {
    console.error('약속 저장 실패:', error);
  }
}

/** 로컬 캐시에도 반영 (같은 브라우저에서 계정을 바꿔 쓰는 경우 대비) */
function mirrorAppointmentLocally(userId: number, mutate: (list: Appointment[]) => Appointment[]) {
  if (typeof window === 'undefined') return;
  try {
    const key = `${APPOINTMENTS_KEY_PREFIX}${userId}`;
    const list: Appointment[] = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(mutate(list)));
  } catch { /* noop */ }
}

/**
 * 참여자에게 약속 전달/수정 (서버가 상대 목록에 반영)
 * 서버는 요청자가 그 약속의 참여자인지, 대상이 친구인지 확인한다.
 */
export async function saveAppointmentForUser(userNickname: string, appointment: Appointment): Promise<void> {
  const userId = nicknameToId(userNickname);
  mirrorAppointmentLocally(userId, (list) =>
    list.some(a => a.id === appointment.id) ? list : [...list, appointment]
  );
  try {
    await apiFetch(`/api/appointments/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment }),
    });
  } catch (error) {
    console.error('약속 전달 실패:', error);
  }
}

/** 참여자의 약속 갱신 (수락 상태 변경 등) */
export async function updateAppointmentForUser(userNickname: string, appointment: Appointment): Promise<void> {
  const userId = nicknameToId(userNickname);
  mirrorAppointmentLocally(userId, (list) =>
    list.map(a => (a.id === appointment.id ? appointment : a))
  );
  try {
    await apiFetch(`/api/appointments/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment }),
    });
  } catch (error) {
    console.error('약속 갱신 실패:', error);
  }
}

/** 참여자의 약속 삭제 (취소·거절) */
export async function removeAppointmentForUser(userNickname: string, apptId: string): Promise<void> {
  const userId = nicknameToId(userNickname);
  mirrorAppointmentLocally(userId, (list) => list.filter(a => a.id !== apptId));
  try {
    await apiFetch(`/api/appointments/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeId: apptId }),
    });
  } catch (error) {
    console.error('약속 삭제 실패:', error);
  }
}
