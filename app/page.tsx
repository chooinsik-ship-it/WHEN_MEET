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
  saveGroupInvitation
} from './utils/storage';

/**
 * 사용자 인터페이스
 */
interface User {
  id: number;
  nickname: string;
  location?: string;
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
  
  // 그룹 삭제 확인 모달
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<Group | null>(null);
  
  // 현재 활성화된 탭
  const [activeTab, setActiveTab] = useState<'my' | 'compare' | 'group'>('my');

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

    // 저장된 그룹 불러오기
    const savedGroups = localStorage.getItem(`groups_${user.id}`);
    if (savedGroups) {
      setGroups(JSON.parse(savedGroups));
    }

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
    setGroups([]);
    setPendingInvitations([]);
    setCurrentInvitation(null);
    setIsLoadingSchedule(false);
    setActiveTab('my');
  };

  /**
   * 그룹 초대 수락
   */
  const handleAcceptInvitation = (invitation: GroupInvitation) => {
    if (!currentUser) return;

    // 그룹을 내 그룹 목록에 추가
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

    // 닉네임을 해시하여 고유 ID 생성
    const id = friendNickname.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    const friendId = Math.abs(id);

    // 이미 추가된 친구인지 확인
    if (friends.some(f => f.id === friendId)) {
      alert('이미 추가된 친구입니다.');
      return;
    }

    // 친구의 시간표 + 거주지 서버에서 동시 로드
    const [friendSchedule, friendUserData] = await Promise.all([
      loadSchedule(friendId).then(s => s || createEmptySchedule()),
      loadUser(friendId),
    ]);

    const friendLocation = friendUserData?.location as string | undefined;

    setFriends([...friends, {
      id: friendId,
      nickname: friendNickname.trim(),
      schedule: friendSchedule,
      location: friendLocation,
    }]);

    setFriendNickname('');
  };

  /**
   * 친구 제거
   */
  const handleRemoveFriend = (friendId: number) => {
    setFriends(friends.filter(f => f.id !== friendId));
  };

  /**
   * 그룹 생성
   */
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      alert('그룹명을 입력해주세요.');
      return;
    }

    if (!memberNicknames.trim()) {
      alert('멤버 닉네임을 입력해주세요.');
      return;
    }

    if (!currentUser) return;

    // 쉼표로 구분된 닉네임 배열로 변환 (공백 제거)
    const members = memberNicknames
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (members.length === 0) {
      alert('유효한 멤버 닉네임을 입력해주세요.');
      return;
    }

    const newGroup: Group = {
      id: Date.now().toString(),
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
    
    // 각 멤버에게 그룹 초대 저장
    const invitation: GroupInvitation = {
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
    // 서버 + 로컬에 저장
    await saveUser(updatedUser.id, updatedUser);
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
   * 내 시간표 변경 시 자동 저장
   */
  useEffect(() => {
    if (currentUser && !isLoadingSchedule) {
      saveSchedule(currentUser.id, mySchedule);
    }
  }, [mySchedule, currentUser, isLoadingSchedule]);

  // 추천 문구 생성 (모든 친구 + 내 시간표 고려)
  const recommendation = friends.length > 0
    ? generateRecommendation([mySchedule, ...friends.map(f => f.schedule)])
    : '';

  // 지하철역 추천 계산
  const subwayRecommendations = (() => {
    if (friends.length === 0 || !currentUser?.location) {
      return [];
    }
    
    // 모든 사용자의 위치 정보 수집
    const locations = [];
    
    // 내 위치 추가
    const myCoord = addressToCoordinate(currentUser.location);
    if (myCoord) {
      locations.push(myCoord);
    }
    
    // 친구들의 위치 추가
    friends.forEach(friend => {
      if (friend.location) {
        const coord = addressToCoordinate(friend.location);
        if (coord) {
          locations.push(coord);
        }
      }
    });
    
    // 최소 2명 이상의 위치가 있어야 추천
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
            <div className="flex items-center gap-3">
              <img 
                src="/WHENMEET_logo_clean.png" 
                alt="언제만나 로고" 
                className="h-12 sm:h-24 w-auto"
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
            <div className="flex justify-center sm:justify-end">
              <SimpleLogin
                currentUser={currentUser}
                onLogin={handleLogin}
                onLogout={handleLogout}
              />
            </div>
          </div>
          {currentUser ? (
            <div className="hidden sm:block text-center space-y-2">
              <p className="text-lg text-black">
                <span className="font-bold text-brand-600">{currentUser.nickname}</span>님, 환영해요! 👋
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-black">드래그</span>로 바쁜 시간을 표시하면, 친구와 겹치는 시간을 <span className="font-semibold text-black">자동 추천</span>해드려요.
              </p>
            </div>
          ) : (
            <p className="text-black text-center">
              닉네임을 입력하고 나만의 시간표를 관리하세요
            </p>
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
                {activeTab === 'my' && '📋 내가 바쁜 시간을 먼저 표시해요'}
                {activeTab === 'compare' && '🔍 겹치는 여유 시간을 자동 추천해요'}
                {activeTab === 'group' && '👥 그룹/친구를 추가하고 관리해요'}
              </p>
            </div>

            {/* 탭 콘텐츠 */}
            <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
              {activeTab === 'my' ? (
                <div>
                  <TimeGrid
                    schedule={mySchedule}
                    onChange={setMySchedule}
                    title="내 시간표"
                  />
                  {/* 거주지 설정 */}
                  <div className="mt-6 p-4 bg-brand-50 border border-brand-200 rounded-lg">
                    <h3 className="text-base font-bold text-brand-700 mb-1">📍 거주지 설정 <span className="text-xs font-normal text-gray-400">(선택)</span></h3>
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

                  {/* 친구 목록 */}
                  {friends.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-black mb-3">
                        비교 중인 친구들 ({friends.length}명)
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {friends.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex items-center gap-2 px-3 py-2 bg-brand-100 rounded-lg"
                          >
                            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold">
                              {friend.nickname[0].toUpperCase()}
                            </div>
                            <span className="text-black font-medium">
                              {friend.nickname}
                            </span>
                            <button
                              onClick={() => handleRemoveFriend(friend.id)}
                              className="ml-2 text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {friends.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">
                        친구를 추가하여 시간표를 비교해보세요!
                      </p>
                    </div>
                  ) : (
                    <>
                      <OverlapGrid 
                        schedule1={mySchedule} 
                        schedule2={friends[0].schedule}
                        allSchedules={[mySchedule, ...friends.map(f => f.schedule)]}
                        participantNames={[currentUser.nickname, ...friends.map(f => f.nickname)]}
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
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 p-3 bg-white rounded-lg hover:shadow-md transition flex-wrap"
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
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-3">
                            💡 모든 멤버의 거주지를 고려한 중간 지점입니다
                          </p>
                        </div>
                      )}
                      
                      {/* 거주지 정보가 부족할 때 */}
                      {friends.length > 0 && subwayRecommendations.length === 0 && (
                        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                          <h3 className="text-lg font-bold text-black mb-2">
                            📍 거주지 정보가 필요해요
                          </h3>
                          <p className="text-sm text-gray-700">
                            {!currentUser?.location && '회원님의 거주지 정보가 없습니다. '}
                            {friends.some(f => !f.location) && '일부 친구의 거주지 정보가 없습니다. '}
                            모두 거주지를 입력하면 중간 지점 지하철역을 추천해드릴 수 있어요!
                          </p>
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
                      <textarea
                        value={memberNicknames}
                        onChange={(e) => setMemberNicknames(e.target.value)}
                        placeholder="멤버 닉네임을 쉼표로 구분하여 입력 (예: 민수, 밍숭, 갯밍숭달팽이)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-black resize-none"
                        rows={3}
                      />
                      <div className="text-sm text-gray-600">
                        💡 팁: 쉼표(,)로 구분하여 여러 멤버를 추가할 수 있습니다.
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
                              삭제
                            </button>
                          </div>
                          <div className="mb-2">
                            <span className="text-sm font-semibold text-gray-700">멤버:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {group.members.map((member, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                                >
                                  {member}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-3">
                            생성일: {new Date(group.createdAt).toLocaleDateString('ko-KR')} | 클릭하여 스케줄 확인
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

      {/* 그룹 스케줄 모달 */}
      {selectedGroup && (
        <GroupScheduleModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          groupName={selectedGroup.name}
          memberNicknames={selectedGroup.members}
          creatorNickname={selectedGroup.creator}
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
                그룹 삭제
              </h2>
            </div>
            
            <div className="mb-6">
              <p className="text-center text-black mb-2">
                <span className="font-bold text-red-600">{deleteConfirmGroup.name}</span> 그룹을 삭제하시겠습니까?
              </p>
              <p className="text-center text-sm text-gray-500">
                이 작업은 취소할 수 없습니다.
              </p>
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
                  handleDeleteGroup(deleteConfirmGroup.id);
                  setDeleteConfirmGroup(null);
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