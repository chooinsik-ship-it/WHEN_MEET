'use client';

import { useState, useEffect } from 'react';
import TimeGrid from './components/TimeGrid';
import OverlapGrid from './components/OverlapGrid';
import SimpleLogin from './components/SimpleLogin';
import GroupScheduleModal from './components/GroupScheduleModal';
import GroupInvitationModal from './components/GroupInvitationModal';
import { generateRecommendation } from './utils/recommendation';
import { 
  saveSchedule, 
  loadSchedule,
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
}

/**
 * 친구 인터페이스
 */
interface Friend {
  id: number;
  nickname: string;
  schedule: boolean[][];
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
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    // 저장된 시간표 불러오기
    const savedSchedule = await loadSchedule(user.id);
    if (savedSchedule) {
      setMySchedule(savedSchedule);
    }
    
    // 저장된 그룹 불러오기
    const savedGroups = localStorage.getItem(`groups_${user.id}`);
    if (savedGroups) {
      setGroups(JSON.parse(savedGroups));
    }
    
    // 대기 중인 그룹 초대 확인
    const invitations = loadPendingInvitations(user.id);
    if (invitations.length > 0) {
      setPendingInvitations(invitations);
      setCurrentInvitation(invitations[0]); // 첫 번째 초대 표시
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

    // 친구의 시간표 불러오기 (서버에서)
    const friendSchedule = await loadSchedule(friendId) || createEmptySchedule();

    setFriends([...friends, {
      id: friendId,
      nickname: friendNickname.trim(),
      schedule: friendSchedule,
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
    if (currentUser) {
      saveSchedule(currentUser.id, mySchedule);
    }
  }, [mySchedule, currentUser]);

  // 추천 문구 생성 (모든 친구 + 내 시간표 고려)
  const recommendation = friends.length > 0
    ? generateRecommendation([mySchedule, ...friends.map(f => f.schedule)])
    : '';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="언제만나 로고" 
                className="h-24 w-auto"
              />
              <h1 
                className="font-bold text-sky-500" 
                style={{ 
                  fontFamily: 'var(--font-jua)', 
                  fontSize: '2.7rem',
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)',
                  WebkitTextStroke: '0.5px rgba(2, 132, 199, 0.3)'
                }}
              >
                언제만나
              </h1>
            </div>
            <SimpleLogin
              currentUser={currentUser}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />
          </div>
          {currentUser ? (
            <div className="text-center space-y-2">
              <p className="text-lg text-black">
                <span className="font-bold text-blue-600">{currentUser.nickname}</span>님, 환영해요! 👋
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
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="mb-6">
              <svg
                className="w-24 h-24 mx-auto text-gray-300"
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
            <h2 className="text-2xl font-bold text-black mb-4">
              시작하기
            </h2>
            <p className="text-gray-600 mb-6">
              닉네임을 입력하면 시간표를 저장하고 관리할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            {/* 탭 네비게이션 */}
            <div className="flex gap-2 mb-6 border-b border-gray-300">
              <button
                onClick={() => setActiveTab('my')}
                className={`px-6 py-3 font-semibold transition-all duration-200 rounded-t-lg ${
                  activeTab === 'my'
                    ? 'border-b-2 border-blue-500 text-black bg-blue-50'
                    : 'text-gray-600 hover:text-black hover:bg-blue-100 hover:scale-105 cursor-pointer'
                }`}
              >
                내 시간표
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-6 py-3 font-semibold transition-all duration-200 rounded-t-lg ${
                  activeTab === 'compare'
                    ? 'border-b-2 border-blue-500 text-black bg-blue-50'
                    : 'text-gray-600 hover:text-black hover:bg-blue-100 hover:scale-105 cursor-pointer'
                }`}
              >
                친구들과 비교
              </button>
              <button
                onClick={() => setActiveTab('group')}
                className={`px-6 py-3 font-semibold transition-all duration-200 rounded-t-lg ${
                  activeTab === 'group'
                    ? 'border-b-2 border-blue-500 text-black bg-blue-50'
                    : 'text-gray-600 hover:text-black hover:bg-blue-100 hover:scale-105 cursor-pointer'
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
            <div className="bg-white rounded-lg shadow-lg p-6">
              {activeTab === 'my' ? (
                <TimeGrid
                  schedule={mySchedule}
                  onChange={setMySchedule}
                  title="내 시간표"
                />
              ) : activeTab === 'compare' ? (
                <div>
                  {/* 친구 추가 폼 */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <form onSubmit={handleAddFriend} className="flex gap-2">
                      <input
                        type="text"
                        value={friendNickname}
                        onChange={(e) => setFriendNickname(e.target.value)}
                        placeholder="친구 닉네임 입력"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                        maxLength={20}
                      />
                      <button
                        type="submit"
                        className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
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
                            className="flex items-center gap-2 px-3 py-2 bg-blue-100 rounded-lg"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
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
                      />
                      
                      {/* 추천 문구 표시 */}
                      <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                        <h3 className="text-lg font-bold text-black mb-2">
                          만남 추천
                        </h3>
                        <p className="text-black">{recommendation}</p>
                      </div>
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                        maxLength={30}
                      />
                      <textarea
                        value={memberNicknames}
                        onChange={(e) => setMemberNicknames(e.target.value)}
                        placeholder="멤버 닉네임을 쉼표로 구분하여 입력 (예: 철수, 영희, 민수)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black resize-none"
                        rows={3}
                      />
                      <div className="text-sm text-gray-600">
                        💡 팁: 쉼표(,)로 구분하여 여러 멤버를 추가할 수 있습니다.
                      </div>
                      <button
                        type="submit"
                        className="w-full px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 hover:scale-105 transition-all duration-200 cursor-pointer"
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
                                handleDeleteGroup(group.id);
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
    </div>
  );
}