'use client';

import { useState, useEffect } from 'react';
import TimeGrid from './components/TimeGrid';
import OverlapGrid from './components/OverlapGrid';
import SimpleLogin from './components/SimpleLogin';
import { generateRecommendation } from './utils/recommendation';
import { saveSchedule, loadSchedule } from './utils/storage';

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
  
  // 현재 활성화된 탭
  const [activeTab, setActiveTab] = useState<'my' | 'compare'>('my');

  /**
   * 로그인 처리
   */
  const handleLogin = async (user: User) => {
    setCurrentUser(user);
    
    // 저장된 시간표 불러오기
    const savedSchedule = await loadSchedule(user.id);
    if (savedSchedule) {
      setMySchedule(savedSchedule);
    }
  };

  /**
   * 로그아웃 처리
   */
  const handleLogout = () => {
    setCurrentUser(null);
    setMySchedule(createEmptySchedule());
    setFriends([]);
    setActiveTab('my');
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
   * 내 시간표 변경 시 자동 저장
   */
  useEffect(() => {
    if (currentUser) {
      saveSchedule(currentUser.id, mySchedule);
    }
  }, [mySchedule, currentUser]);

  // 추천 문구 생성 (모든 친구 시간표 고려)
  const recommendation = friends.length > 0
    ? generateRecommendation(mySchedule, friends[0].schedule) // 첫 번째 친구와 비교
    : '';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <header className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-4xl font-bold text-black">
              언제만나
            </h1>
            <SimpleLogin
              currentUser={currentUser}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />
          </div>
          <p className="text-black text-center">
            {currentUser
              ? `${currentUser.nickname}님, 시간표를 입력하고 친구와 비교해보세요!`
              : '닉네임을 입력하고 나만의 시간표를 관리하세요'}
          </p>
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
                className={`px-6 py-3 font-semibold transition ${
                  activeTab === 'my'
                    ? 'border-b-2 border-blue-500 text-black'
                    : 'text-black hover:text-gray-800'
                }`}
              >
                내 시간표
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-6 py-3 font-semibold transition ${
                  activeTab === 'compare'
                    ? 'border-b-2 border-blue-500 text-black'
                    : 'text-black hover:text-gray-800'
                }`}
              >
                친구들과 비교
              </button>
            </div>

            {/* 탭 콘텐츠 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              {activeTab === 'my' && (
                <TimeGrid
                  schedule={mySchedule}
                  onChange={setMySchedule}
                  title="내 시간표"
                />
              )}
              {activeTab === 'my' && (
                <TimeGrid
                  schedule={mySchedule}
                  onChange={setMySchedule}
                  title="내 시간표"
                />
              )}

              {activeTab === 'compare' && (
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
              )}
            </div>
          </>
        )}

        {/* 푸터 */}
        <footer className="mt-8 text-center text-sm text-black">
          <p>Made with Next.js + Tailwind CSS</p>
        </footer>
      </div>
    </div>
  );
}