'use client';

import { useState, useEffect } from 'react';
import TimeGrid from './components/TimeGrid';
import OverlapGrid from './components/OverlapGrid';
import SimpleLogin from './components/SimpleLogin';
import GroupScheduleModal from './components/GroupScheduleModal';
import GroupInvitationModal from './components/GroupInvitationModal';
import LocationEditor from './components/LocationEditor';
import { generateRecommendation } from './utils/recommendation';
import { addressToCoordinate, recommendSubwayStations } from './utils/subway';
import { 
  saveSchedule, 
  loadSchedule,
  saveUser,
  loadUser,
  GroupInvitation,
  loadPendingInvitations,
  removeGroupInvitation,
  saveGroupInvitation,
  AppNotification,
  Appointment,
  loadNotifications,
  markNotificationsRead,
  removeNotification,
  saveNotification,
  saveAppointmentForUser,
  removeAppointmentForUser,
  updateAppointmentForUser,
  nicknameToId,
} from './utils/storage';

/**
 * 사용자 인터페이스
 */
interface User {
  id: number;
  nickname: string;
  location?: string;
  avatar?: string;
}

/**
 * 친구 인터페이스
 */
interface Friend {
  id: number;
  nickname: string;
  schedule: boolean[][];
  location?: string;
}

/**
 * 그룹 인터페이스
 */
interface Group {
  id: string;
  name: string;
  creator: string;
  creatorId: number;
  members: string[]; // 멤버 닉네임 배열
  createdAt: string;
}

/**
 * 빈 스케줄 초기화 함수
 * @returns 7일 x 24시간 배열 (모두 false = 여유)
 */
function createEmptySchedule(): boolean[][] {
  return Array(7).fill(null).map(() => Array(24).fill(false));
}

export default function Home() {
  // 현재 로그인한 사용자
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // 내 시간표
  const [mySchedule, setMySchedule] = useState<boolean[][]>(createEmptySchedule());
  
  // 스케줄 로딩 상태
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  
  // 친구 목록
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // 친구 닉네임 입력
  const [friendNickname, setFriendNickname] = useState('');
  
  // 비교할 친구 선택 (ID 목록)
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  // 친구 시간표 단독 보기 (ID, null 이면 전체 비교)
  const [viewFriendId, setViewFriendId] = useState<number | null>(null);

  // 확정된 약속 목록
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // 새 약속 입력 폼
  const [newApptName, setNewApptName] = useState('');
  const [newApptDay, setNewApptDay] = useState(0);
  const [newApptStart, setNewApptStart] = useState(14);
  const [newApptEnd, setNewApptEnd] = useState(16);

  // 그룹 목록
  const [groups, setGroups] = useState<Group[]>([]);
  
  // 그룹 생성 폼
  const [groupName, setGroupName] = useState('');
  const [memberNicknames, setMemberNicknames] = useState(''); // 쉼표로 구분
  
  // 모달 상태
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 그룹 초대 상태
  const [pendingInvitations, setPendingInvitations] = useState<GroupInvitation[]>([]);
  const [currentInvitation, setCurrentInvitation] = useState<GroupInvitation | null>(null);
  
  // 약속 취소 확인 모달
  const [cancelAppt, setCancelAppt] = useState<Appointment | null>(null);
  // 약속 수정 모드 (모달 내 인라인)
  const [editAppt, setEditAppt] = useState<{ name: string; day: number; startHour: number; endHour: number; participants: string[] } | null>(null);
  // 수정 모달 내 새 참여자 입력
  const [newParticipantInput, setNewParticipantInput] = useState('');

  // 알림
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // 그룹 삭제 확인 모달
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<Group | null>(null);
  // 친구 삭제 확인
  const [deleteConfirmFriend, setDeleteConfirmFriend] = useState<Friend | null>(null);

  // 그룹 약속 확정 폼 (어떤 그룹에 약속을 잡고 있는지)
  const [groupApptTarget, setGroupApptTarget] = useState<Group | null>(null);
  const [groupApptName, setGroupApptName] = useState('');
  const [groupApptDay, setGroupApptDay] = useState(0);
  const [groupApptStart, setGroupApptStart] = useState(14);
  const [groupApptEnd, setGroupApptEnd] = useState(16);
  
  // 현재 활성화된 탭
  const [activeTab, setActiveTab] = useState<'my' | 'compare' | 'group'>('my');

  // 빠른 입력 취침 시간 (null = 없음, 0~23 = 해당 시각에 취침)
  const [sleepTime, setSleepTime] = useState<number | null>(null);
  // 빠른 입력 선택된 일과 템플릿
  const [selectedTemplate, setSelectedTemplate] = useState<{ label: string; start: number; end: number } | null>(null);

  /**
   * 페이지 로드 시 localStorage에서 사용자 복원
   */
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser) as User;
      handleLogin(user);
    }
  }, []);

  /**
   * 로그인 처리
   */
  const handleLogin = async (user: User) => {
    // 데이터를 먼저 모두 로드한 뒤 state를 한 번에 설정 (useEffect가 빈 시간표를 덮어쓰는 것 방지)
    const serverUserData = await loadUser(user.id);
    const mergedUser: User = serverUserData
      ? { ...user, location: user.location ?? (serverUserData.location as string | undefined) }
      : user;

    // 사용자 정보를 서버 + 로컬에 저장 (친구가 검색할 수 있도록)
    await saveUser(mergedUser.id, mergedUser);

    // 시간표 로드
    const savedSchedule = await loadSchedule(user.id);

    // 모든 데이터 준비 완료 후 state 일괄 설정 → useEffect가 올바른 시간표로 실행됨
    localStorage.setItem('currentUser', JSON.stringify(mergedUser));
    setCurrentUser(mergedUser);
    setMySchedule(savedSchedule ?? createEmptySchedule());
    setIsLoadingSchedule(false);

    // 저장된 친구 목록 불러오기 (닉네임 → 서버에서 시간표 재로드)
    const savedFriendNicknames = localStorage.getItem(`friends_${user.id}`);
    if (savedFriendNicknames) {
      const nicknames: string[] = JSON.parse(savedFriendNicknames);
      const loadedFriends = await Promise.all(
        nicknames.map(async (nickname) => {
          const id = Math.abs(nickname.split('').reduce((acc: number, char: string) => {
            return ((acc << 5) - acc) + char.charCodeAt(0);
          }, 0));
          const [schedule, userData] = await Promise.all([
            loadSchedule(id).then((s) => s || createEmptySchedule()),
            loadUser(id),
          ]);
          return {
            id,
            nickname,
            schedule,
            location: userData?.location as string | undefined,
          };
        })
      );
      setFriends(loadedFriends);
    }

    // 저장된 그룹 불러오기
    const savedGroups = localStorage.getItem(`groups_${user.id}`);
    if (savedGroups) {
      setGroups(JSON.parse(savedGroups));
    }

    // 저장된 약속 불러오기
    const savedAppointments = localStorage.getItem(`appointments_${user.id}`);
    if (savedAppointments) {
      setAppointments(JSON.parse(savedAppointments));
    }

    // 알림 불러오기
    const notifs = loadNotifications(user.id);
    setNotifications(notifs);

    // 대기 중인 그룹 초대 확인
    const invitations = loadPendingInvitations(user.id);
    if (invitations.length > 0) {
      setPendingInvitations(invitations);
      setCurrentInvitation(invitations[0]);
    }
  };

  /**
   * 로그아웃 처리
   */
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setMySchedule(createEmptySchedule());
    setFriends([]);
    setSelectedFriendIds([]);
    setGroups([]);
    setAppointments([]);
    setNotifications([]);
    setShowNotifications(false);
    setPendingInvitations([]);;
    setCurrentInvitation(null);
    setIsLoadingSchedule(false);
    setActiveTab('my');
  };

  /**
   * 그룹 초대 수락
   */
  const handleAcceptInvitation = (invitation: GroupInvitation) => {
    if (!currentUser) return;

    // 그룹을 내 그룹 목록에 추가 (중복 방지)
    if (groups.some(g => g.id === invitation.groupId)) {
      removeGroupInvitation(currentUser.id, invitation.groupId);
      const remainingInvitations = pendingInvitations.filter(inv => inv.groupId !== invitation.groupId);
      setPendingInvitations(remainingInvitations);
      setCurrentInvitation(remainingInvitations.length > 0 ? remainingInvitations[0] : null);
      return;
    }

    const newGroup: Group = {
      id: invitation.groupId,
      name: invitation.groupName,
      creator: invitation.creatorNickname,
      creatorId: invitation.creatorId,
      members: invitation.members,
      createdAt: invitation.createdAt,
    };

    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    localStorage.setItem(`groups_${currentUser.id}`, JSON.stringify(updatedGroups));

    // 기존 멤버들(creator + 멤버)의 localStorage에 현재 유저를 멤버로 추가
    const existingParticipants = [
      { nickname: invitation.creatorNickname, id: invitation.creatorId },
      ...invitation.members
        .filter(m => m !== currentUser.nickname)
        .map(m => ({ nickname: m, id: nicknameToId(m) })),
    ];
    existingParticipants.forEach(({ id }) => {
      try {
        const raw = localStorage.getItem(`groups_${id}`);
        if (raw) {
          const memberGroups: Group[] = JSON.parse(raw);
          const updated = memberGroups.map(g =>
            g.id === invitation.groupId && !g.members.includes(currentUser.nickname)
              ? { ...g, members: [...g.members, currentUser.nickname] }
              : g
          );
          localStorage.setItem(`groups_${id}`, JSON.stringify(updated));
        }
      } catch { /* 다른 사용자 데이터 접근 시 무시 */ }
    });

    // 초대 삭제
    removeGroupInvitation(currentUser.id, invitation.groupId);
    
    // 다음 초대가 있으면 표시, 없으면 모달 닫기
    const remainingInvitations = pendingInvitations.filter(
      inv => inv.groupId !== invitation.groupId
    );
    setPendingInvitations(remainingInvitations);
    
    if (remainingInvitations.length > 0) {
      setCurrentInvitation(remainingInvitations[0]);
    } else {
      setCurrentInvitation(null);
    }

    // 그룹 탭으로 이동
    setActiveTab('group');
  };

  /**
   * 그룹 초대 거절
   */
  const handleDeclineInvitation = (invitation: GroupInvitation) => {
    if (!currentUser) return;

    // 초대 삭제
    removeGroupInvitation(currentUser.id, invitation.groupId);
    
    // 다음 초대가 있으면 표시, 없으면 모달 닫기
    const remainingInvitations = pendingInvitations.filter(
      inv => inv.groupId !== invitation.groupId
    );
    setPendingInvitations(remainingInvitations);
    
    if (remainingInvitations.length > 0) {
      setCurrentInvitation(remainingInvitations[0]);
    } else {
      setCurrentInvitation(null);
    }
  };

  /**
   * 친구 추가
   */
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!friendNickname.trim()) {
      alert('친구 닉네임을 입력해주세요.');
      return;
    }

    if (friendNickname.trim() === currentUser?.nickname) {
      alert('자기 자신은 추가할 수 없습니다.');
      return;
    }

    const friendId = Math.abs(friendNickname.trim().split('').reduce((acc: number, char: string) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0));

    // localStorage 기준으로 확인 (React state가 스태일할 수 있음)
    const myStoredFriends: string[] = JSON.parse(localStorage.getItem(`friends_${currentUser!.id}`) || '[]');
    if (myStoredFriends.includes(friendNickname.trim())) {
      // 스태일 state 동기화
      setFriends(prev => prev.filter(f => myStoredFriends.includes(f.nickname)));
      alert('이미 친구입니다.');
      return;
    }

    // 상대방이 업스토어에 존재하는지 확인
    const friendUserData = await loadUser(friendId);
    if (!friendUserData) {
      alert('존재하지 않는 사용자입니다. 닉네임을 확인해주세요.');
      return;
    }

    // 이미 요청을 보냈는지 확인 (이중 발송 방지)
    const sentKey = `friend_requests_sent_${currentUser!.id}`;
    const sentList: string[] = JSON.parse(localStorage.getItem(sentKey) || '[]');
    if (sentList.includes(friendNickname.trim())) {
      alert('이미 친구 요청을 보냈습니다. 수락 대기 중입니다.');
      return;
    }

    // 상대방에게 친구 요청 알림 전송
    saveNotification(friendNickname.trim(), {
      type: 'friend_request',
      message: `👤 ${currentUser!.nickname}님이 친구 요청을 보냈습니다.`,
      fromNickname: currentUser!.nickname,
    });

    // 발송 목록에 기록
    sentList.push(friendNickname.trim());
    localStorage.setItem(sentKey, JSON.stringify(sentList));

    alert(`${friendNickname.trim()}님에게 친구 요청을 보냈습니다!`);
    setFriendNickname('');
  };

  /**
   * 친구 요청 수락
   */
  const handleAcceptFriendRequest = async (n: AppNotification) => {
    if (!currentUser || !n.fromNickname) return;
    const fromNickname = n.fromNickname;
    const fromId = Math.abs(fromNickname.split('').reduce((acc: number, char: string) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0));

    // 이미 친구인지 확인 (localStorage 기준 - React state가 스태일할 수 있음)
    const myStoredFriends: string[] = JSON.parse(localStorage.getItem(`friends_${currentUser.id}`) || '[]');
    if (myStoredFriends.includes(fromNickname)) {
      removeNotification(currentUser.id, n.id);
      setNotifications(prev => prev.filter(x => x.id !== n.id));
      return;
    }

    // 요청자의 스케줄 로드
    const [fromSchedule, fromUserData] = await Promise.all([
      loadSchedule(fromId).then(s => s || createEmptySchedule()),
      loadUser(fromId),
    ]);

    const newFriend = {
      id: fromId,
      nickname: fromNickname,
      schedule: fromSchedule,
      location: fromUserData?.location as string | undefined,
    };

    // 내 친구 목록에 추가
    const updatedFriends = [...friends, newFriend];
    setFriends(updatedFriends);
    localStorage.setItem(`friends_${currentUser.id}`, JSON.stringify(updatedFriends.map(f => f.nickname)));

    // 요청자의 친구 목록에도 나를 추가
    try {
      const theirKey = `friends_${fromId}`;
      const theirList: string[] = JSON.parse(localStorage.getItem(theirKey) || '[]');
      if (!theirList.includes(currentUser.nickname)) {
        theirList.push(currentUser.nickname);
        localStorage.setItem(theirKey, JSON.stringify(theirList));
      }
      // 요청자의 발송 기록 제거
      const sentKey = `friend_requests_sent_${fromId}`;
      const sentList: string[] = JSON.parse(localStorage.getItem(sentKey) || '[]');
      localStorage.setItem(sentKey, JSON.stringify(sentList.filter((s: string) => s !== currentUser.nickname)));
    } catch { /* 무시 */ }

    // 수락 알림 상대방에게 전송
    saveNotification(fromNickname, {
      type: 'friend_accepted',
      message: `✅ ${currentUser.nickname}님이 친구 요청을 수락했습니다!`,
    });

    removeNotification(currentUser.id, n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
  };

  /**
   * 친구 요청 거절
   */
  const handleRejectFriendRequest = (n: AppNotification) => {
    if (!currentUser || !n.fromNickname) return;
    const fromNickname = n.fromNickname;

    // 요청자의 발송 기록 제거
    try {
      const fromId = Math.abs(fromNickname.split('').reduce((acc: number, char: string) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0));
      const sentKey = `friend_requests_sent_${fromId}`;
      const sentList: string[] = JSON.parse(localStorage.getItem(sentKey) || '[]');
      localStorage.setItem(sentKey, JSON.stringify(sentList.filter((s: string) => s !== currentUser.nickname)));
    } catch { /* 무시 */ }

    // 거절 알림 상대방에게 전송
    saveNotification(fromNickname, {
      type: 'friend_rejected',
      message: `❌ ${currentUser.nickname}님이 친구 요청을 거절했습니다.`,
    });

    removeNotification(currentUser.id, n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
  };

  /**
   * 친구 제거
   */
  const handleRemoveFriend = (friendId: number) => {
    const removedFriend = friends.find(f => f.id === friendId);
    const updatedFriends = friends.filter(f => f.id !== friendId);
    setFriends(updatedFriends);
    setSelectedFriendIds(prev => prev.filter(id => id !== friendId));
    if (currentUser) {
      // 내 친구 목록에서 제거
      localStorage.setItem(`friends_${currentUser.id}`, JSON.stringify(updatedFriends.map(f => f.nickname)));

      if (removedFriend) {
        // 상대방 친구 목록에서 나를 제거
        const theirKey = `friends_${friendId}`;
        const theirList: string[] = JSON.parse(localStorage.getItem(theirKey) || '[]');
        localStorage.setItem(theirKey, JSON.stringify(theirList.filter(n => n !== currentUser.nickname)));

        // 상대방에게 알림 전송 (fromNickname 포함)
        saveNotification(removedFriend.nickname, {
          type: 'friend_removed',
          message: `💔 ${currentUser.nickname}님이 친구를 삭제했습니다.`,
          fromNickname: currentUser.nickname,
        });

        // 양쪽 friend_requests_sent_ 정리 (재추가 시 오류 방지)
        const mySentKey = `friend_requests_sent_${currentUser.id}`;
        const mySent: string[] = JSON.parse(localStorage.getItem(mySentKey) || '[]');
        localStorage.setItem(mySentKey, JSON.stringify(mySent.filter(n => n !== removedFriend.nickname)));

        const theirSentKey = `friend_requests_sent_${friendId}`;
        const theirSent: string[] = JSON.parse(localStorage.getItem(theirSentKey) || '[]');
        localStorage.setItem(theirSentKey, JSON.stringify(theirSent.filter(n => n !== currentUser.nickname)));
      }
    }
  };

  /**
   * 그룹 생성
   */
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      alert('그룹명을 입력해주세요.');
      return;
    }

    if (!currentUser) return;

    // 쉼표로 구분된 닉네임 배열로 변환 (공백 제거)
    const members = memberNicknames
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    // 존재하지 않는 멤버 닉네임 검증
    if (members.length > 0) {
      const checkResults = await Promise.all(
        members.map(async (nickname) => {
          const userData = await loadUser(nicknameToId(nickname));
          return { nickname, exists: userData !== null };
        })
      );
      const notFound = checkResults.filter(r => !r.exists).map(r => r.nickname);
      if (notFound.length > 0) {
        alert(`존재하지 않는 유저입니다: ${notFound.join(', ')}`);
        return;
      }
    }

    const newGroup: Group = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: groupName.trim(),
      creator: currentUser.nickname,
      creatorId: currentUser.id,
      members: members,
      createdAt: new Date().toISOString(),
    };

    setGroups([...groups, newGroup]);
    setGroupName('');
    setMemberNicknames('');
    
    // localStorage에 그룹 저장
    const savedGroups = [...groups, newGroup];
    localStorage.setItem(`groups_${currentUser.id}`, JSON.stringify(savedGroups));
    
    if (members.length > 0) {
      const invitation = {
        groupId: newGroup.id,
        groupName: newGroup.name,
        creatorNickname: currentUser.nickname,
        creatorId: currentUser.id,
        members: members,
        createdAt: newGroup.createdAt,
      };
      members.forEach(memberNickname => {
        saveGroupInvitation(memberNickname, invitation);
      });
      alert(`그룹이 생성되었고, ${members.length}명의 멤버에게 초대가 전송되었습니다!`);
    } else {
      alert('그룹이 생성되었습니다!');
    }
  };

  /**
   * 그룹 클릭 시 모달 열기
   */
  const handleGroupClick = (group: Group) => {
    setSelectedGroup(group);
    setIsModalOpen(true);
  };

  /**
   * 거주지 업데이트
   */
  const handleUpdateLocation = async (location: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, location: location.trim() || undefined };
    setCurrentUser(updatedUser);
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    await saveUser(updatedUser.id, updatedUser);
  };

  /**
   * 프로필(아바타/닉네임) 업데이트
   */
  const handleUpdateProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    saveUser(updatedUser.id, updatedUser);
  };

  /**
   * 약속 초대 다시 보내기 (미수락 참여자에게만)
   */
  const handleResendInvite = (appt: Appointment) => {
    if (!currentUser) return;
    const accepted = appt.acceptedBy ?? [];
    const pending = appt.participants.filter(p => !accepted.includes(p));
    if (pending.length === 0) return;
    const dayName = ['월','화','수','목','금','토','일'][appt.day];
    pending.forEach(nickname => {
      saveNotification(nickname, {
        type: 'appointment_invite',
        message: `🔔 ${currentUser.nickname}님이 [${appt.name}] 약속 초대를 다시 보냈습니다. (${dayName}요일 ${String(appt.startHour).padStart(2,'0')}:00~${String(appt.endHour).padStart(2,'0')}:00)`,
        appointment: appt,
      });
    });
    alert(`${pending.join(', ')}님에게 초대를 다시 보냈습니다.`);
  };

  /**
   * 약속 취소 (+ 참여자에게 알림)
   */
  const handleCancelAppointment = (appt: Appointment) => {
    if (!currentUser) return;
    const updated = appointments.filter(a => a.id !== appt.id);
    setAppointments(updated);
    localStorage.setItem(`appointments_${currentUser.id}`, JSON.stringify(updated));

    // 자신을 제외한 다른 참여자에게 알림 + localStorage에서도 삭제
    const dayName = ['월','화','수','목','금','토','일'][appt.day];
    const others = appt.participants.filter(p => p !== currentUser.nickname);
    others.forEach(nickname => {
      removeAppointmentForUser(nickname, appt.id);
      saveNotification(nickname, {
        type: 'appointment_cancelled',
        message: `❌ ${currentUser.nickname}님이 [${appt.name}] 약속을 취소했습니다. (${dayName}요일 ${String(appt.startHour).padStart(2,'0')}:00~${String(appt.endHour).padStart(2,'0')}:00)`,
      });
    });

    setCancelAppt(null);
    setEditAppt(null);
  };

  /**
   * 약속 수정 (시간/이름/요일 변경 + 참여자에게 알림)
   */
  const handleEditAppointment = () => {
    if (!currentUser || !cancelAppt || !editAppt) return;
    if (editAppt.startHour >= editAppt.endHour) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    const newParticipants = editAppt.participants;
    const addedParticipants = newParticipants.filter(p => !cancelAppt.participants.includes(p));
    const updated: Appointment = { ...cancelAppt, ...editAppt, participants: newParticipants, acceptedBy: cancelAppt.acceptedBy ?? [currentUser.nickname] };
    const newList = appointments.map(a => a.id === cancelAppt.id ? updated : a);
    setAppointments(newList);
    localStorage.setItem(`appointments_${currentUser.id}`, JSON.stringify(newList));
    const dayName = ['월','화','수','목','금','토','일'][updated.day];
    // 기존 참여자: 수정 알림
    cancelAppt.participants.filter(p => p !== currentUser.nickname).forEach(nickname => {
      removeAppointmentForUser(nickname, updated.id);
      saveAppointmentForUser(nickname, updated);
      saveNotification(nickname, {
        type: 'appointment_accepted',
        message: `✏️ ${currentUser.nickname}님이 [${updated.name}] 약속을 수정했습니다. (${dayName}요일 ${String(updated.startHour).padStart(2,'0')}:00~${String(updated.endHour).padStart(2,'0')}:00)`,
      });
    });
    // 새 참여자: 초대 알림 (상대방 pending 상태로 저장)
    addedParticipants.forEach(nickname => {
      saveAppointmentForUser(nickname, { ...updated, status: 'pending' });
      saveNotification(nickname, {
        type: 'appointment_invite',
        message: `📩 ${currentUser.nickname}님이 [${updated.name}] 약속에 초대했습니다. (${dayName}요일 ${String(updated.startHour).padStart(2,'0')}:00~${String(updated.endHour).padStart(2,'0')}:00)`,
        appointment: { ...updated, status: 'pending' },
      });
    });
    setCancelAppt(null);
    setEditAppt(null);
    setNewParticipantInput('');
  };

  /**
   * 약속 확정 (나에게 저장 + 다른 참여자에게 초대 알림 발송)
   */
  const handleAddAppointment = () => {
    if (!currentUser) return;
    if (newApptStart >= newApptEnd) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    const appt: Appointment = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: newApptName.trim() || '약속',
      day: newApptDay,
      startHour: newApptStart,
      endHour: newApptEnd,
      participants: [currentUser.nickname, ...selectedFriends.map(f => f.nickname)],
      acceptedBy: [currentUser.nickname],
      createdAt: new Date().toISOString(),
      status: selectedFriends.length > 0 ? 'pending' : 'confirmed',
    };

    // 나에게만 확정 저장
    const updated = [...appointments, appt];
    setAppointments(updated);
    localStorage.setItem(`appointments_${currentUser.id}`, JSON.stringify(updated));

    // 다른 참여자에게 초대 알림 발송 (수락 전까지 저장 안 함)
    const dayName = ['월','화','수','목','금','토','일'][appt.day];
    selectedFriends.forEach(friend => {
      saveNotification(friend.nickname, {
        type: 'appointment_invite',
        message: `📩 ${currentUser.nickname}님이 [${appt.name}] 약속에 초대했습니다. (${dayName}요일 ${String(appt.startHour).padStart(2,'0')}:00~${String(appt.endHour).padStart(2,'0')}:00)`,
        appointment: appt,
      });
    });

    setNewApptName('');
  };

  /**
   * 약속 초대 수락
   */
  const handleAcceptInvite = (n: AppNotification) => {
    if (!currentUser || !n.appointment) return;
    const appt = n.appointment;
    const creator = appt.participants[0];

    // 알림에 저장된 acceptedBy는 생성 시점 스냅샷이라 다른 참여자의 수락이 반영 안 됨.
    // creator의 localStorage에서 최신 acceptedBy를 읽어 베이스로 사용한다.
    let latestAcceptedBy: string[] = appt.acceptedBy ?? [appt.participants[0]];
    try {
      const creatorId = nicknameToId(creator);
      const creatorAppts: Appointment[] = JSON.parse(localStorage.getItem(`appointments_${creatorId}`) || '[]');
      const creatorAppt = creatorAppts.find(a => a.id === appt.id);
      if (creatorAppt?.acceptedBy) latestAcceptedBy = creatorAppt.acceptedBy;
    } catch { /* noop */ }

    const updatedAcceptedBy = [...new Set([...latestAcceptedBy, currentUser.nickname])];
    const allAccepted = appt.participants.every(p => updatedAcceptedBy.includes(p));
    const updatedAppt: Appointment = {
      ...appt,
      acceptedBy: updatedAcceptedBy,
      status: allAccepted ? 'confirmed' : 'pending',
    };

    // 내 localStorage에 저장
    const existing: Appointment[] = JSON.parse(localStorage.getItem(`appointments_${currentUser.id}`) || '[]');
    const newList = existing.some(a => a.id === updatedAppt.id)
      ? existing.map(a => a.id === updatedAppt.id ? updatedAppt : a)
      : [...existing, updatedAppt];
    setAppointments(prev => prev.some(a => a.id === updatedAppt.id)
      ? prev.map(a => a.id === updatedAppt.id ? updatedAppt : a)
      : [...prev, updatedAppt]
    );
    localStorage.setItem(`appointments_${currentUser.id}`, JSON.stringify(newList));

    // 작성자의 localStorage도 acceptedBy 업데이트
    if (creator !== currentUser.nickname) {
      updateAppointmentForUser(creator, updatedAppt);
      const dayName = ['월','화','수','목','금','토','일'][appt.day];
      saveNotification(creator, {
        type: 'appointment_accepted',
        message: allAccepted
          ? `🎉 [${appt.name}] 약속에 모든 참여자가 수락했습니다! (${dayName}요일 ${String(appt.startHour).padStart(2,'0')}:00~${String(appt.endHour).padStart(2,'0')}:00)`
          : `✅ ${currentUser.nickname}님이 [${appt.name}] 약속을 수락했습니다. (${updatedAcceptedBy.length}/${appt.participants.length}명 수락)`,
      });
    }

    // 전원 수락 시 이미 수락한 참여자들의 localStorage도 confirmed로 동기화
    if (allAccepted) {
      appt.participants.forEach(p => {
        if (p !== currentUser.nickname && p !== creator) {
          updateAppointmentForUser(p, updatedAppt);
        }
      });
    }

    removeNotification(currentUser.id, n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
  };

  /**
   * 약속 초대 거절
   */
  const handleRejectInvite = (n: AppNotification) => {
    if (!currentUser || !n.appointment) return;
    const appt = n.appointment;
    removeNotification(currentUser.id, n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    // 작성자에게 거절 알림
    const creator = appt.participants[0];
    if (creator !== currentUser.nickname) {
      const dayName = ['월','화','수','목','금','토','일'][appt.day];
      saveNotification(creator, {
        type: 'appointment_rejected',
        message: `❌ ${currentUser.nickname}님이 [${appt.name}] 약속 초대를 거절했습니다. (${dayName}요일 ${String(appt.startHour).padStart(2,'0')}:00~${String(appt.endHour).padStart(2,'0')}:00)`,
      });
    }
  };

  /**
   * 약속 삭제
   */
  const handleDeleteAppointment = (id: string) => {
    if (!currentUser) return;
    const updated = appointments.filter(a => a.id !== id);
    setAppointments(updated);
    localStorage.setItem(`appointments_${currentUser.id}`, JSON.stringify(updated));
  };

  /**
   * 그룹 약속 확정 (그룹 멤버 전체에게 초대 발송)
   */
  const handleAddGroupAppointment = () => {
    if (!currentUser || !groupApptTarget) return;
    if (groupApptStart >= groupApptEnd) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }
    const appt: Appointment = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: groupApptName.trim() || '약속',
      day: groupApptDay,
      startHour: groupApptStart,
      endHour: groupApptEnd,
      participants: [currentUser.nickname, ...groupApptTarget.members.filter(m => m !== currentUser.nickname)],
      acceptedBy: [currentUser.nickname],
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    const updated = [...appointments, appt];
    setAppointments(updated);
    localStorage.setItem(`appointments_${currentUser.id}`, JSON.stringify(updated));
    const dayName = ['월','화','수','목','금','토','일'][appt.day];
    groupApptTarget.members.filter(m => m !== currentUser.nickname).forEach(memberNickname => {
      saveNotification(memberNickname, {
        type: 'appointment_invite',
        message: `📬 ${currentUser.nickname}님이 [${groupApptTarget.name}] 그룹에서 [${appt.name}] 약속에 초대했습니다. (${dayName}요일 ${String(appt.startHour).padStart(2,'0')}:00~${String(appt.endHour).padStart(2,'0')}:00)`,
        appointment: appt,
      });
    });
    setGroupApptName('');
    setGroupApptTarget(null);
  };

  /**
   * 그룹 삭제
   */
  const handleDeleteGroup = (groupId: string) => {
    if (!currentUser) return;
    const updatedGroups = groups.filter(g => g.id !== groupId);
    setGroups(updatedGroups);
    localStorage.setItem(`groups_${currentUser.id}`, JSON.stringify(updatedGroups));
  };

  /**
   * 그룹에 새 멤버 초대 (그룹 모달 내에서 호출)
   */
  const handleInviteToGroup = (targetNickname: string, isFriend: boolean) => {
    if (!currentUser || !selectedGroup) return;
    if (targetNickname === currentUser.nickname) {
      alert('자기 자신은 초대할 수 없습니다.');
      return;
    }
    const alreadyIn = [selectedGroup.creator, ...selectedGroup.members];
    if (alreadyIn.includes(targetNickname)) {
      alert('이미 그룹에 참여 중인 멤버입니다.');
      return;
    }

    // 초대만 저장 — 수락 전에는 멤버로 추가하지 않음
    const invitation: GroupInvitation = {
      groupId: selectedGroup.id,
      groupName: selectedGroup.name,
      creatorNickname: selectedGroup.creator,
      creatorId: selectedGroup.creatorId,
      members: [...selectedGroup.members, targetNickname],
      createdAt: selectedGroup.createdAt,
      fromNonFriend: !isFriend,
    };
    saveGroupInvitation(targetNickname, invitation);

    alert(`${targetNickname}님에게 초대를 전송했습니다!`);
  };

  /**
   * 그룹명 변경 (모달 내 인라인 편집)
   */
  const handleRenameGroup = (groupId: string, newName: string) => {
    if (!currentUser || !selectedGroup) return;
    const updatedGroup: Group = { ...selectedGroup, name: newName };
    const updatedGroups = groups.map(g => g.id === groupId ? updatedGroup : g);
    setGroups(updatedGroups);
    setSelectedGroup(updatedGroup);
    localStorage.setItem(`groups_${currentUser.id}`, JSON.stringify(updatedGroups));
    // 다른 멤버들의 localStorage도 동기화
    const allGroupMembers = [selectedGroup.creator, ...selectedGroup.members];
    allGroupMembers.filter(m => m !== currentUser.nickname).forEach(nickname => {
      const memberId = nicknameToId(nickname);
      try {
        const raw = localStorage.getItem(`groups_${memberId}`);
        if (raw) {
          const memberGroups: Group[] = JSON.parse(raw);
          const updated = memberGroups.map(g => g.id === groupId ? { ...g, name: newName } : g);
          localStorage.setItem(`groups_${memberId}`, JSON.stringify(updated));
        }
      } catch { /* 다른 사용자 데이터 접근 실패 시 무시 */ }
    });
  };

  /**
   * 그룹 나가기 (일반 멤버) 또는 그룹 삭제 (생성자)
   */
  const handleLeaveGroup = (group: Group) => {
    if (!currentUser) return;
    // 내 목록에서 제거
    handleDeleteGroup(group.id);
    const others = group.members.filter(m => m !== currentUser.nickname);
    if (others.length === 0) {
      // 마지막 멤버: 그룹 자동 소멸 (추가 작업 없음)
      setDeleteConfirmGroup(null);
      return;
    }
    // 남은 멤버들의 localStorage에서 해당 그룹의 members 배열 업데이트
    others.forEach(nickname => {
      const memberId = nicknameToId(nickname);
      const key = `groups_${memberId}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const memberGroups: Group[] = JSON.parse(raw);
          const updated = memberGroups.map(g =>
            g.id === group.id
              ? { ...g, members: g.members.filter(m => m !== currentUser.nickname) }
              : g
          );
          localStorage.setItem(key, JSON.stringify(updated));
        }
      } catch { /* 다른 사용자 데이터 접근 실패 시 무시 */ }
      // 남은 멤버들에게 알림 발송
      saveNotification(nickname, {
        type: 'appointment_cancelled',
        message: `🚪 ${currentUser.nickname}님이 [${group.name}] 그룹에서 나갔습니다.`,
      });
    });
    setDeleteConfirmGroup(null);
  };

  /**
   * 내 시간표 변경 시 자동 저장
   */
  useEffect(() => {
    if (currentUser && !isLoadingSchedule) {
      saveSchedule(currentUser.id, mySchedule);
    }
  }, [mySchedule, currentUser, isLoadingSchedule]);

  // 비교 선택된 친구들
  const selectedFriends = friends.filter(f => selectedFriendIds.includes(f.id));

  // 추천 문구 생성 (선택된 친구 + 내 시간표 고려)
  const recommendation = selectedFriends.length > 0
    ? generateRecommendation([mySchedule, ...selectedFriends.map(f => f.schedule)])
    : '';

  // 지하철역 추천 계산
  const subwayRecommendations = (() => {
    if (selectedFriends.length === 0 || !currentUser?.location) {
      return [];
    }
    
    const locations = [];
    
    const myCoord = addressToCoordinate(currentUser.location);
    if (myCoord) {
      locations.push(myCoord);
    }
    
    selectedFriends.forEach(friend => {
      if (friend.location) {
        const coord = addressToCoordinate(friend.location);
        if (coord) {
          locations.push(coord);
        }
      }
    });
    
    if (locations.length < 2) {
      return [];
    }
    
    return recommendSubwayStations(locations, 5);
  })();

  return (
    <div className="min-h-screen bg-brand-50 py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <header className="mb-8">
          <div className="flex flex-col items-center sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <div
              className="flex items-center gap-6 cursor-pointer"
              onClick={() => { if (currentUser) setActiveTab('my'); }}
            >
              <img 
                src="/WHENMEET_logo_new_clean.png" 
                alt="언제만나 로고" 
                className="h-9 sm:h-18 w-auto"
              />
              <h1 
                className="font-bold" 
                style={{ 
                  fontFamily: 'var(--font-jua)', 
                  fontSize: 'clamp(1.4rem, 5vw, 2.7rem)',
                  color: '#6B80A5',
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.08)',
                  WebkitTextStroke: '0.5px rgba(107, 128, 165, 0.3)'
                }}
              >
                언제 만나
              </h1>
            </div>
            <div className="flex justify-center sm:justify-end items-center gap-2">
              <SimpleLogin
                currentUser={currentUser}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onUpdateProfile={handleUpdateProfile}
              />
            </div>
          </div>
          {!currentUser && (
            <div className="text-center space-y-1">
              <p className="text-black">
                <span className="font-semibold">드래그</span>로 바쁜 시간을 표시하면, 친구와 겹치는 시간을 <span className="font-semibold">자동 추천</span>해드려요.
              </p>
              <p className="text-sm text-gray-500">나만의 시간표를 관리하세요</p>
            </div>
          )}
        </header>

        {!currentUser ? (
          // 로그인 안 한 경우
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-12 text-center">
            <div className="mb-6">
              <svg
                className="w-16 h-16 sm:w-24 sm:h-24 mx-auto text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-black mb-4">
              시작하기
            </h2>
            <p className="text-gray-600 mb-6">
              닉네임을 입력하면 시간표를 저장하고 관리할 수 있습니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600">
              <div className="p-3 bg-brand-50 rounded-lg">
                <p className="text-2xl mb-1">🗓️</p>
                <p className="font-semibold text-black">내 시간표</p>
                <p>드래그로 바쁜 시간 표시</p>
              </div>
              <div className="p-3 bg-brand-50 rounded-lg">
                <p className="text-2xl mb-1">🔍</p>
                <p className="font-semibold text-black">친구와 비교</p>
                <p>격치는 여유 시간 자동 추천</p>
              </div>
              <div className="p-3 bg-brand-50 rounded-lg">
                <p className="text-2xl mb-1">🚇</p>
                <p className="font-semibold text-black">중간 지점</p>
                <p>거주지 기반 지하철역 추천</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 탭 네비게이션 */}
            <div className="flex mb-6 border-b border-gray-300">
              <button
                onClick={() => setActiveTab('my')}
                className={`flex-1 px-2 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-200 rounded-t-lg ${
                  activeTab === 'my'
                    ? 'border-b-2 border-brand-500 text-brand-700 bg-brand-50'
                    : 'text-gray-600 hover:text-brand-700 hover:bg-brand-100 cursor-pointer'
                }`}
              >
                내 시간표
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`flex-1 px-2 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-200 rounded-t-lg ${
                  activeTab === 'compare'
                    ? 'border-b-2 border-brand-500 text-brand-700 bg-brand-50'
                    : 'text-gray-600 hover:text-brand-700 hover:bg-brand-100 cursor-pointer'
                }`}
              >
                친구들과 비교
              </button>
              <button
                onClick={() => setActiveTab('group')}
                className={`flex-1 px-2 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-200 rounded-t-lg ${
                  activeTab === 'group'
                    ? 'border-b-2 border-brand-500 text-brand-700 bg-brand-50'
                    : 'text-gray-600 hover:text-brand-700 hover:bg-brand-100 cursor-pointer'
                }`}
              >
                그룹 관리
              </button>
            </div>

            {/* 탭 설명 */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                {activeTab === 'my' && '📋 드래그로 나의 일정을 표시하면, 친구와 겹치는 시간을 자동 추천해드려요.'}
                {activeTab === 'compare' && '🔍 친구와 겹치는 여유 시간을 자동 추천해요'}
                {activeTab === 'group' && '👥 그룹/친구를 추가하고 관리해요'}
              </p>
            </div>

            {/* 탭 콘텐츠 */}
            <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
              {activeTab === 'my' ? (
                <div>
                  {/* 빠른 시간표 템플릿 */}
                  {(() => {
                    const applyTemplate = (start: number, end: number, sleep: number | null, label: string) => {
                      setSelectedTemplate({ label, start, end });
                      const s = mySchedule.map((day, dIdx) =>
                        day.map((_, hIdx) => {
                          if (dIdx >= 5) return mySchedule[dIdx][hIdx];
                          const isWork = hIdx >= start && hIdx < end;
                          let isSleep = false;
                          if (sleep !== null) {
                            if (sleep < start) {
                              isSleep = hIdx >= sleep && hIdx < start;
                            } else if (sleep > end - 1) {
                              isSleep = hIdx >= sleep || hIdx < start;
                            }
                          }
                          return isWork || isSleep;
                        })
                      );
                      setMySchedule(s);
                    };
                    const workTemplates = [
                      { label: '직장인 08~17', start: 8, end: 17 },
                      { label: '직장인 09~18', start: 9, end: 18 },
                      { label: '직장인 10~19', start: 10, end: 19 },
                    ];
                    const studentTemplates = [
                      { label: '초등학생', start: 9, end: 15 },
                      { label: '중학생', start: 8, end: 16 },
                      { label: '고등학생', start: 8, end: 22 },
                    ];
                    return (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-semibold text-gray-700 mb-2">⚡ 빠른 입력</p>
                        {/* 취침 시간 선택 */}
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1.5">🌙 취침 시간</p>
                          <div className="flex flex-wrap gap-1">
                            {([null, ...Array.from({ length: 24 }, (_, i) => i)] as (number | null)[]).map((t) => {
                              const label = t === null ? '없음' : `${String(t).padStart(2, '0')}시`;
                              const active = sleepTime === t;
                              return (
                                <button
                                  key={label}
                                  onClick={() => {
                                    setSleepTime(t);
                                    if (selectedTemplate) {
                                      applyTemplate(selectedTemplate.start, selectedTemplate.end, t, selectedTemplate.label);
                                    }
                                  }}
                                  className={`px-2 py-1 text-xs font-medium rounded-lg border transition cursor-pointer ${
                                    active
                                      ? 'bg-indigo-500 text-white border-indigo-500'
                                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {/* 직장인 */}
                          {workTemplates.map(({ label, start, end }) => (
                            <button
                              key={label}
                              onClick={() => applyTemplate(start, end, sleepTime, label)}
                              className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition cursor-pointer ${
                                selectedTemplate?.label === label
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                              }`}
                            >
                              💼 {label}
                            </button>
                          ))}
                          {/* 학생 */}
                          {studentTemplates.map(({ label, start, end }) => (
                            <button
                              key={label}
                              onClick={() => applyTemplate(start, end, sleepTime, label)}
                              className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition cursor-pointer ${
                                selectedTemplate?.label === label
                                  ? 'bg-green-500 text-white border-green-500'
                                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              }`}
                            >
                              🎒 {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          월~금 기준으로 바쁜 시간을 채워드려요.{sleepTime !== null ? ` 취침(${String(sleepTime).padStart(2, '0')}시) + 근무·수업 시간이 함께 적용됩니다.` : ' 취침 시간을 설정하면 수면 구간도 함께 채워져요.'}
                        </p>
                      </div>
                    );
                  })()}
                  <TimeGrid
                    schedule={mySchedule}
                    onChange={setMySchedule}
                    title="내 시간표"
                    appointments={appointments}
                    onAppointmentClick={(id) => {
                      const appt = appointments.find(a => a.id === id);
                      if (appt) setCancelAppt(appt);
                    }}
                  />
                  {/* 거주지 설정 */}
                  <div className="mt-6 p-4 bg-brand-50 border border-brand-200 rounded-lg">
                    <h3 className="text-base font-bold text-brand-700 mb-1">거주지 설정 <span className="text-xs font-normal text-gray-400">(선택)</span></h3>
                    <p className="text-xs text-gray-500 mb-3">입력하면 친구들과 중간 지점 지하철역을 추천해드려요</p>
                    <LocationEditor
                      currentLocation={currentUser.location}
                      onSave={handleUpdateLocation}
                    />
                  </div>
                </div>
              ) : activeTab === 'compare' ? (
                <div>
                  {/* 친구 추가 폼 */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <form onSubmit={handleAddFriend} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={friendNickname}
                        onChange={(e) => setFriendNickname(e.target.value)}
                        placeholder="친구 닉네임 입력"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-black"
                        maxLength={20}
                      />
                      <button
                        type="submit"
                        className="px-6 py-2 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition"
                      >
                        친구 추가
                      </button>
                    </form>
                  </div>

                  {/* 내 친구 목록 */}
                  {friends.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">
                        친구를 추가하여 시간표를 비교해보세요!
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-black">
                            내 친구 목록 ({friends.length}명)
                          </h3>
                          {selectedFriendIds.length > 0 && (
                            <span className="text-sm text-brand-600 font-medium">
                              {selectedFriendIds.length}명 비교 중
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {friends.map((friend) => {
                            const isSelected = selectedFriendIds.includes(friend.id);
                            return (
                              <div
                                key={friend.id}
                                onClick={() => setViewFriendId(prev => prev === friend.id ? null : friend.id)}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                                  viewFriendId === friend.id
                                    ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200'
                                    : isSelected
                                    ? 'bg-brand-50 border-brand-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {friend.nickname[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-medium text-black">{friend.nickname}</p>
                                    {friend.location && (
                                      <p className="text-xs text-gray-400">{friend.location}</p>
                                    )}
                                    {viewFriendId === friend.id && (
                                      <p className="text-xs text-purple-500 font-semibold mt-0.5">📅 시간표 보는 중</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFriendIds(prev =>
                                        isSelected
                                          ? prev.filter(id => id !== friend.id)
                                          : [...prev, friend.id]
                                      );
                                    }}
                                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg border transition-all duration-200 ${
                                      isSelected
                                        ? 'bg-brand-500 text-white border-brand-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-600'
                                    }`}
                                  >
                                    {isSelected ? '✓ 비교중' : '비교 선택'}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmFriend(friend); }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                    title="친구 삭제"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 비교 영역 */}
                      {viewFriendId !== null ? (
                        // 단독 시간표 보기 (선택 여부와 무관하게 우선 처리)
                        (() => {
                          const viewFriend = friends.find(f => f.id === viewFriendId);
                          if (!viewFriend) return null;
                          return (
                            <>
                              <div className="mb-3 px-1 flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-700">
                                  📅 <span className="text-purple-600 font-bold">{viewFriend.nickname}</span>님의 시간표
                                </p>
                                <button
                                  onClick={() => setViewFriendId(null)}
                                  className="text-xs text-gray-400 hover:text-brand-500 underline cursor-pointer"
                                >
                                  전체 비교로 돌아가기
                                </button>
                              </div>
                              <OverlapGrid
                                schedule1={viewFriend.schedule}
                                schedule2={createEmptySchedule()}
                                allSchedules={[viewFriend.schedule]}
                                participantNames={[viewFriend.nickname]}
                              />
                            </>
                          );
                        })()
                      ) : selectedFriends.length === 0 ? (
                        <div className="p-4 bg-gray-50 rounded-lg text-center">
                          <p className="text-gray-500 text-sm">
                            👆 비교할 친구를 선택하세요
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3 px-1">
                            <p className="text-sm font-semibold text-gray-700">
                              📊 시간표 비교 ({1 + selectedFriends.length}명) :{' '}
                              <span className="text-brand-600">{currentUser.nickname}(나)</span>
                              {selectedFriends.map(f => (
                                <span key={f.id}>,{' '}
                                  <button
                                    onClick={() => setViewFriendId(f.id)}
                                    className="text-gray-800 hover:text-purple-600 hover:underline cursor-pointer font-semibold"
                                  >{f.nickname}</button>
                                </span>
                              ))}
                            </p>
                          </div>
                          <OverlapGrid
                            schedule1={mySchedule}
                            schedule2={selectedFriends[0].schedule}
                            allSchedules={[mySchedule, ...selectedFriends.map(f => f.schedule)]}
                            participantNames={[currentUser.nickname, ...selectedFriends.map(f => f.nickname)]}
                          />

                          {/* 추천 문구 표시 */}
                          <div className="mt-6 p-4 bg-brand-50 border-l-4 border-brand-400 rounded">
                            <h3 className="text-lg font-bold text-black mb-2">
                              ⏰ 시간대 추천
                            </h3>
                            <p className="text-black">{recommendation}</p>
                          </div>

                          {/* 지하철역 추천 표시 */}
                          {subwayRecommendations.length > 0 && (
                            <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-500 rounded">
                              <h3 className="text-lg font-bold text-black mb-3">
                                🚇 중간 지점 지하철역 추천
                              </h3>
                              <div className="space-y-2">
                                {subwayRecommendations.map((station, idx) => (
                                  <a
                                    key={idx}
                                    href={`https://map.naver.com/p/search/${encodeURIComponent(station.name + ' 맛집')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between gap-2 p-3 bg-white rounded-lg hover:shadow-md hover:bg-green-50 transition flex-wrap cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                                        {idx + 1}
                                      </div>
                                      <div>
                                        <p className="font-bold text-black">
                                          {station.name}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                          {station.line}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600">
                                          평균 거리
                                        </p>
                                        <p className="font-semibold text-green-600">
                                          {station.avgDistance.toFixed(1)}km
                                        </p>
                                      </div>
                                  </a>
                                ))}
                              </div>
                              <p className="text-xs text-gray-500 mt-3">
                                💡 모든 멤버의 거주지를 고려한 중간 지점입니다
                              </p>
                            </div>
                          )}

                          {/* 거주지 정보가 부족할 때 */}
                          {subwayRecommendations.length === 0 && (
                            <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                              <h3 className="text-lg font-bold text-black mb-2">
                                거주지 정보가 필요해요
                              </h3>
                              <p className="text-sm text-gray-700">
                                {!currentUser?.location && '회원님의 거주지 정보가 없습니다. '}
                                {selectedFriends.some(f => !f.location) && '일부 친구의 거주지 정보가 없습니다. '}
                                모두 거주지를 입력하면 중간 지점 지하철역을 추천해드릴 수 있어요!
                              </p>
                            </div>
                          )}

                          {/* 약속 확정 폼 */}
                          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h3 className="text-base font-bold text-blue-700 mb-3">📅 약속 확정하기</h3>
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                value={newApptName}
                                onChange={(e) => setNewApptName(e.target.value)}
                                placeholder="약속 이름 (예: 점심 약속)"
                                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                maxLength={30}
                              />
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <select
                                  value={newApptDay}
                                  onChange={(e) => setNewApptDay(Number(e.target.value))}
                                  className="px-2 py-1.5 border border-blue-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                                >
                                  {['월요일','화요일','수요일','목요일','금요일','토요일','일요일'].map((d, i) => (
                                    <option key={i} value={i}>{d}</option>
                                  ))}
                                </select>
                                <select
                                  value={newApptStart}
                                  onChange={(e) => setNewApptStart(Number(e.target.value))}
                                  className="px-2 py-1.5 border border-blue-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                                >
                                  {Array.from({length: 24}, (_, i) => (
                                    <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                                  ))}
                                </select>
                                <span className="text-blue-600 font-semibold">~</span>
                                <select
                                  value={newApptEnd}
                                  onChange={(e) => setNewApptEnd(Number(e.target.value))}
                                  className="px-2 py-1.5 border border-blue-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                                >
                                  {Array.from({length: 24}, (_, i) => (
                                    <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={handleAddAppointment}
                                className="w-full py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition cursor-pointer text-sm"
                              >
                                약속 확정하기
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {/* 확정된 약속 목록 */}
                      {appointments.length > 0 && (
                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h3 className="text-base font-bold text-blue-700 mb-3">📋 확정된 약속</h3>
                          <div className="space-y-2">
                            {appointments.map((appt) => {
                              const dayName = ['월','화','수','목','금','토','일'][appt.day];
                              const isPending = appt.status === 'pending';
                              return (
                                <div
                                  key={appt.id}
                                  onClick={() => setCancelAppt(appt)}
                                  className={`p-3 rounded-lg cursor-pointer transition hover:opacity-85 active:scale-[0.98] ${isPending ? 'bg-yellow-200 text-gray-800' : 'bg-blue-500 text-white'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold">{appt.name}</p>
                                    {isPending && <span className="text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-semibold">⏳ 수락 대기중</span>}
                                  </div>
                                  <p className={`text-sm mt-0.5 ${isPending ? 'text-gray-600' : 'text-blue-100'}`}>
                                    {dayName}요일 {String(appt.startHour).padStart(2,'0')}:00 ~ {String(appt.endHour).padStart(2,'0')}:00
                                  </p>
                                  <p className={`text-xs mt-0.5 ${isPending ? 'text-gray-500' : 'text-blue-200'}`}>{appt.participants.join(', ')}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {/* 그룹 생성 폼 */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-bold text-black mb-4">새 그룹 만들기</h3>
                    <form onSubmit={handleCreateGroup} className="space-y-3">
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="그룹명 입력 (예: 스터디 모임, 동아리 등)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-black"
                        maxLength={30}
                      />
                      {/* 친구 목록 태그 */}
                      {friends.length > 0 && (() => {
                        const selectedSet = new Set(
                          memberNicknames.split(',').map(s => s.trim()).filter(Boolean)
                        );
                        return (
                          <div>
                            <p className="text-xs text-gray-500 mb-2 font-medium">💙 친구 클릭하여 추가/제거</p>
                            <div className="flex flex-wrap gap-2">
                              {friends.map(f => {
                                const isAdded = selectedSet.has(f.nickname);
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => {
                                      const cur = memberNicknames.split(',').map(s => s.trim()).filter(Boolean);
                                      if (isAdded) {
                                        setMemberNicknames(cur.filter(n => n !== f.nickname).join(', '));
                                      } else {
                                        setMemberNicknames([...cur, f.nickname].join(', '));
                                      }
                                    }}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition cursor-pointer ${
                                      isAdded
                                        ? 'bg-brand-500 text-white border-brand-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400 hover:text-brand-600'
                                    }`}
                                  >
                                    {isAdded && <span>✓</span>}
                                    {f.nickname}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <p className="text-xs text-gray-500 mb-1">직접 입력 (쉼표로 구분) — 비워두면 그룹만 생성</p>
                        <textarea
                          value={memberNicknames}
                          onChange={(e) => setMemberNicknames(e.target.value)}
                          placeholder="멤버 닉네임 (예: 민수, 밍숭)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-black resize-none text-sm"
                          rows={2}
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full px-6 py-2 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 hover:scale-[1.01] transition-all duration-200 cursor-pointer"
                      >
                        그룹 생성하기
                      </button>
                    </form>
                  </div>

                  {/* 그룹 목록 */}
                  {groups.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">
                        그룹을 만들어 여러 친구들의 시간표를 한 번에 비교해보세요!
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        그룹명과 멤버 닉네임을 입력하여 그룹을 생성하세요.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-black mb-3">
                        내 그룹 ({groups.length}개)
                      </h3>
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition cursor-pointer"
                          onClick={() => handleGroupClick(group)}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="text-xl font-bold text-black">{group.name}</h4>
                              <p className="text-sm text-gray-500 mt-1">
                                만든 사람: {group.creator}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmGroup(group);
                              }}
                              className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded transition"
                            >
                              {'그룹 나가기'}
                            </button>
                          </div>
                          <div className="mb-2">
                            <span className="text-sm font-semibold text-gray-700">멤버:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {group.members.map((member) => (
                                <span
                                  key={member}
                                  className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                                >
                                  {member}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-3">
                            생성일: {new Date(group.createdAt).toLocaleDateString('ko-KR')} | 클릭하여 스케줄 확인 및 약속 관리
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* 푸터 */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>WHEN MEET · Asia/Seoul 기준</p>
        </footer>
      </div>

      {/* 우측 하단 고정 알림 버튼 */}
      {currentUser && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50">
          {showNotifications && (
            <div className="absolute bottom-14 right-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="font-bold text-black text-sm">🔔 알림</p>
                <div className="flex items-center gap-2">
                  {notifications.some(n => n.type !== 'friend_request' && n.type !== 'appointment_invite') && (
                    <button
                      onClick={() => {
                        if (!currentUser) return;
                        const actionTypes = ['friend_request', 'appointment_invite'];
                        const kept = notifications.filter(n => actionTypes.includes(n.type));
                        localStorage.setItem(`notifications_${currentUser.id}`, JSON.stringify(kept));
                        setNotifications(kept);
                      }}
                      className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer"
                    >모두 삭제</button>
                  )}
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">알림이 없어요.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className={`px-4 py-3 border-b border-gray-50 ${n.read ? '' : 'bg-blue-50'}`}>
                      {n.type === 'appointment_invite' && n.appointment ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-sm text-gray-700">{n.message}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptInvite(n)}
                              className="flex-1 py-1 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition cursor-pointer"
                            >✅ 수락</button>
                            <button
                              onClick={() => handleRejectInvite(n)}
                              className="flex-1 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-red-100 hover:text-red-600 transition cursor-pointer"
                            >❌ 거절</button>
                          </div>
                        </div>
                      ) : n.type === 'friend_request' ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-sm text-gray-700">{n.message}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptFriendRequest(n)}
                              className="flex-1 py-1 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition cursor-pointer"
                            >👍 수락</button>
                            <button
                              onClick={() => handleRejectFriendRequest(n)}
                              className="flex-1 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-red-100 hover:text-red-600 transition cursor-pointer"
                            >👎 거절</button>
                          </div>
                        </div>
                      ) : n.type === 'friend_removed' ? (
                        <div className="flex items-start gap-2">
                          <p className="text-sm text-gray-700 flex-1">{n.message}</p>
                          <button
                            onClick={() => {
                              if (!currentUser) return;
                              // 삭제한 유저를 friends state에서도 제거 (스태일 state 동기화)
                              if (n.fromNickname) {
                                setFriends(prev => prev.filter(f => f.nickname !== n.fromNickname));
                                setSelectedFriendIds(prev => {
                                  const removedId = Math.abs(n.fromNickname!.split('').reduce((acc: number, c: string) => ((acc << 5) - acc) + c.charCodeAt(0), 0));
                                  return prev.filter(id => id !== removedId);
                                });
                              }
                              removeNotification(currentUser.id, n.id);
                              setNotifications(prev => prev.filter(x => x.id !== n.id));
                            }}
                            className="text-gray-300 hover:text-red-400 cursor-pointer flex-shrink-0 text-xs mt-0.5"
                          >✕</button>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <p className="text-sm text-gray-700 flex-1">{n.message}</p>
                          <button
                            onClick={() => {
                              if (!currentUser) return;
                              removeNotification(currentUser.id, n.id);
                              setNotifications(prev => prev.filter(x => x.id !== n.id));
                            }}
                            className="text-gray-300 hover:text-red-400 cursor-pointer flex-shrink-0 text-xs mt-0.5"
                          >✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications && currentUser) {
                // localStorage에서 약속 상태 재동기화 (다른 사용자 수락 시 confirmed 반영)
                const saved = localStorage.getItem(`appointments_${currentUser.id}`);
                if (saved) setAppointments(JSON.parse(saved));
              }
            }}
            className="relative w-12 h-12 bg-white border border-gray-200 rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-brand-600 hover:shadow-xl transition cursor-pointer"
            title="알림"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>1
        </div>
      )}

      {/* 약속 취소/수정 모달 */}
      {cancelAppt && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => { setCancelAppt(null); setEditAppt(null); }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            {editAppt ? (
              /* 수정 모드 */
              <>
                <h2 className="text-lg font-bold text-black mb-4">✏️ 약속 수정</h2>
                <div className="flex flex-col gap-3 mb-5">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">약속 이름</label>
                    <input
                      type="text"
                      value={editAppt.name}
                      onChange={(e) => setEditAppt(prev => prev && ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">요일</label>
                    <select
                      value={editAppt.day}
                      onChange={(e) => setEditAppt(prev => prev && ({ ...prev, day: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                    >
                      {['월요일','화요일','수요일','목요일','금요일','토요일','일요일'].map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">시작</label>
                      <select
                        value={editAppt.startHour}
                        onChange={(e) => setEditAppt(prev => prev && ({ ...prev, startHour: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                      >
                        {Array.from({length: 24}, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-gray-400 mt-5">~</span>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">종료</label>
                      <select
                        value={editAppt.endHour}
                        onChange={(e) => setEditAppt(prev => prev && ({ ...prev, endHour: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                      >
                        {Array.from({length: 24}, (_, i) => (
                          <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-4">수정 시 참여자에게 알림이 전송됩니다.</p>

                {/* 참여자 관리 */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-500 mb-2 block">참여자</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editAppt.participants.map((p, idx) => (
                      <span key={idx} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {p}
                        {p !== currentUser?.nickname && (
                          <button
                            onClick={() => setEditAppt(prev => prev && ({ ...prev, participants: prev.participants.filter(x => x !== p) }))}
                            className="text-blue-400 hover:text-red-500 cursor-pointer leading-none"
                          >×</button>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newParticipantInput}
                      onChange={(e) => setNewParticipantInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const t = newParticipantInput.trim();
                          if (!t) return;
                          if (editAppt.participants.includes(t)) { alert('이미 추가된 참여자입니다.'); return; }
                          setEditAppt(prev => prev && ({ ...prev, participants: [...prev.participants, t] }));
                          setNewParticipantInput('');
                        }
                      }}
                      placeholder="닉네임 입력 후 Enter"
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-black text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                      maxLength={20}
                    />
                    <button
                      onClick={() => {
                        const t = newParticipantInput.trim();
                        if (!t) return;
                        if (editAppt.participants.includes(t)) { alert('이미 추가된 참여자입니다.'); return; }
                        setEditAppt(prev => prev && ({ ...prev, participants: [...prev.participants, t] }));
                        setNewParticipantInput('');
                      }}
                      className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition cursor-pointer"
                    >추가</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditAppt(null)}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm cursor-pointer"
                  >뒤로</button>
                  <button
                    onClick={handleEditAppointment}
                    className="flex-1 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition text-sm cursor-pointer"
                  >수정하기</button>
                </div>
              </>
            ) : (
              /* 기본 모드 */
              <>
                <h2 className="text-lg font-bold text-black mb-2">📅 약속 관리</h2>
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-semibold">{cancelAppt.participants.join(', ')}</span>와의 약속입니다.
                </p>
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-semibold">{['월','화','수','목','금','토','일'][cancelAppt.day]}요일</span>{' '}
                  {String(cancelAppt.startHour).padStart(2,'0')}:00 ~ {String(cancelAppt.endHour).padStart(2,'0')}:00
                </p>
                <p className="text-sm font-bold text-blue-600 mb-2">&ldquo;{cancelAppt.name}&rdquo;</p>
                {cancelAppt.status === 'pending' && (() => {
                  const accepted = cancelAppt.acceptedBy ?? [];
                  const pending = cancelAppt.participants.filter(p => !accepted.includes(p));
                  return pending.length > 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3">
                      <p className="text-xs text-yellow-700 mb-1.5">⏳ 수락 대기 중: <span className="font-semibold">{pending.join(', ')}</span></p>
                      <button
                        onClick={() => handleResendInvite(cancelAppt)}
                        className="text-xs bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold px-3 py-1 rounded-full transition cursor-pointer"
                      >📨 초대 다시 보내기</button>
                    </div>
                  ) : null;
                })()}
                <div className="flex gap-2">
                  <button
                    onClick={() => setCancelAppt(null)}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm cursor-pointer"
                  >유지하기</button>
                  <button
                    onClick={() => setEditAppt({ name: cancelAppt.name, day: cancelAppt.day, startHour: cancelAppt.startHour, endHour: cancelAppt.endHour, participants: [...cancelAppt.participants] })}
                    className="flex-1 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition text-sm cursor-pointer"
                  >수정하기</button>
                  <button
                    onClick={() => handleCancelAppointment(cancelAppt)}
                    className="flex-1 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition text-sm cursor-pointer"
                  >취소하기</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 그룹 스케줄 모달 */}
      {selectedGroup && currentUser && (
        <GroupScheduleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          groupName={selectedGroup.name}
          memberNicknames={selectedGroup.members}
          creatorNickname={selectedGroup.creator}
          appointments={appointments.filter(appt =>
            appt.participants.includes(currentUser?.nickname ?? '') &&
            selectedGroup.members.every(m => appt.participants.includes(m))
          )}
          onAddAppointment={({ name, day, startHour, endHour }) => {
            if (!currentUser || !selectedGroup) return;
            if (startHour >= endHour) { alert('종료 시간은 시작 시간보다 늦어야 합니다.'); return; }
            const appt: Appointment = {
              id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              name: name || '약속',
              day, startHour, endHour,
              participants: [currentUser.nickname, ...selectedGroup.members.filter(m => m !== currentUser.nickname)],
              acceptedBy: [currentUser.nickname],
              createdAt: new Date().toISOString(),
              status: 'pending',
            };
            const updated = [...appointments, appt];
            setAppointments(updated);
            localStorage.setItem(`appointments_${currentUser.id}`, JSON.stringify(updated));
            const dayName = ['월','화','수','목','금','토','일'][appt.day];
            selectedGroup.members.filter(m => m !== currentUser.nickname).forEach(memberNickname => {
              saveNotification(memberNickname, {
                type: 'appointment_invite',
                message: `📩 ${currentUser.nickname}님이 [${selectedGroup.name}] 그룹에서 [${appt.name}] 약속에 초대했습니다. (${dayName}요일 ${String(appt.startHour).padStart(2,'0')}:00~${String(appt.endHour).padStart(2,'0')}:00)`,
                appointment: appt,
              });
            });
          }}
          onAppointmentClick={(appt) => setCancelAppt(appt)}
          currentUserNickname={currentUser.nickname}
          friendNicknames={friends.map(f => f.nickname)}
          onInviteMember={(nickname, isFriend) => handleInviteToGroup(nickname, isFriend)}
          onGroupNameChange={(newName) => handleRenameGroup(selectedGroup.id, newName)}
        />
      )}
      
      {/* 그룹 초대 모달 */}
      {currentInvitation && (
        <GroupInvitationModal
          invitation={currentInvitation}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
        />
      )}
      
      {/* 친구 삭제 확인 모달 */}
      {deleteConfirmFriend && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👤</span>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">친구 삭제</h3>
              <p className="text-center text-black mb-2">
                <span className="font-bold text-red-600">{deleteConfirmFriend.nickname}</span>님을 친구 명단에서 삭제하시겠습니까?
              </p>
              <p className="text-center text-sm text-gray-500">이 작업은 취소할 수 없습니다.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmFriend(null)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() => {
                  handleRemoveFriend(deleteConfirmFriend.id);
                  setDeleteConfirmFriend(null);
                }}
                className="flex-1 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition cursor-pointer"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 그룹 삭제 확인 모달 */}
      {deleteConfirmGroup && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">
                그룹 나가기
              </h2>
            </div>
            
            <div className="mb-6">
              <p className="text-center text-black mb-2">
                <span className="font-bold text-red-600">{deleteConfirmGroup.name}</span> 그룹에서 나가시겠습니까?
              </p>
              <p className="text-center text-sm text-gray-500">다른 멤버들에게 알림이 전송됩니다.</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmGroup(null)}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 hover:scale-[1.01] transition-all duration-200 cursor-pointer"
              >
                아니오
              </button>
              <button
                onClick={() => {
                  handleLeaveGroup(deleteConfirmGroup);
                }}
                className="flex-1 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 hover:scale-[1.01] transition-all duration-200 cursor-pointer"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}