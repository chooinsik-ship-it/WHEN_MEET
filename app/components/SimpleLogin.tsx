'use client';

import { useState, useRef } from 'react';

interface User {
  id: number;
  nickname: string;
  location?: string;
  avatar?: string;
}

interface SimpleLoginProps {
  onLogin: (user: User) => void;
  onLogout: () => void;
  currentUser: User | null;
  onUpdateProfile?: (user: User) => void;
}

const AVATAR_EMOJIS = [
  '😊', '😎', '🥳', '😸', '🐱', '🐶', '🦊', '🐻', '🐼', '🐸',
  '🐙', '🦋', '🌸', '⭐', '🌙', '🎮', '🎵', '🏆', '🍕', '🍦',
  '🌈', '🦄', '🎯', '🔥', '💎', '🌊', '🍀', '🎸', '🚀', '👑',
];

export default function SimpleLogin({ onLogin, onLogout, currentUser, onUpdateProfile }: SimpleLoginProps) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 프로필 설정 모달
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState<'avatar' | 'password'>('avatar');

  // 아바타 탭
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 비밀번호 변경 탭
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.');
      return;
    }
    if (!password.trim()) {
      alert('비밀번호를 입력해주세요.');
      return;
    }

    const id = nickname.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const userId = Math.abs(id);

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/auth/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || '비밀번호가 틀렸습니다.');
        setLoading(false);
        return;
      }

      onLogin({ id: userId, nickname: nickname.trim() });
      setNickname('');
      setPassword('');
    } catch {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarSave = () => {
    if (!currentUser) return;
    const updated = { ...currentUser, avatar: selectedAvatar };
    onUpdateProfile?.(updated);
    setShowProfileModal(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('이미지 크기는 2MB 이하여야 합니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSelectedAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (!newPw.trim()) {
      setPwError('새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!currentUser) return;

    setPwLoading(true);
    try {
      const res = await fetch(`/api/auth/${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();

      if (!data.success) {
        setPwError(data.error || '변경에 실패했습니다.');
        return;
      }

      setPwSuccess(true);
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch {
      setPwError('서버 오류가 발생했습니다.');
    } finally {
      setPwLoading(false);
    }
  };

  const openModal = () => {
    setSelectedAvatar(currentUser?.avatar ?? '');
    setProfileTab('avatar');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setPwSuccess(false);
    setShowProfileModal(true);
  };

  const closeModal = () => {
    setShowProfileModal(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setPwSuccess(false);
  };

  // 아바타 표시 헬퍼
  const AvatarDisplay = () => {
    const avatar = currentUser?.avatar;
    if (avatar?.startsWith('data:') || avatar?.startsWith('http')) {
      return (
        <img
          src={avatar}
          alt="avatar"
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    if (avatar) {
      return (
        <span className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-base">
          {avatar}
        </span>
      );
    }
    return (
      <span className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
        {currentUser?.nickname[0].toUpperCase()}
      </span>
    );
  };

  if (!currentUser) {
    return (
      <form onSubmit={handleLogin} className="flex flex-col gap-1.5 items-end w-full sm:w-auto">
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-black w-24 sm:w-28"
            maxLength={20}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-black w-24 sm:w-28"
            maxLength={30}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 sm:px-6 py-2 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition whitespace-nowrap disabled:opacity-60 text-sm sm:text-base cursor-pointer"
          >
            {loading ? '...' : '시작하기'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <p className="text-xs text-gray-400">💡 처음 사용하시면 비밀번호가 자동 설정됩니다</p>
      </form>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 bg-gray-200 px-4 py-2 rounded-lg">
        <button
          onClick={openModal}
          title="프로필 설정"
          className="flex-shrink-0 hover:opacity-80 transition cursor-pointer"
        >
          <AvatarDisplay />
        </button>
        <div className="flex flex-col">
          <span className="font-medium text-black">{currentUser.nickname}</span>
          {currentUser.location && (
            <span className="text-xs text-gray-600">{currentUser.location}</span>
          )}
        </div>
        <button
          onClick={onLogout}
          className="px-3 py-1 bg-gray-300 text-black text-sm rounded hover:bg-gray-400 transition cursor-pointer"
        >
          로그아웃
        </button>
      </div>

      {/* 프로필 설정 모달 */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-black">프로필 설정</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">✕</button>
            </div>

            {/* 탭 */}
            <div className="flex border-b border-gray-200 px-5">
              {(['avatar', 'password'] as const).map((tab) => {
                const labels = { avatar: '아바타', password: '비밀번호' };
                return (
                  <button
                    key={tab}
                    onClick={() => setProfileTab(tab)}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                      profileTab === tab
                        ? 'border-b-2 border-brand-500 text-brand-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {/* 아바타 탭 */}
              {profileTab === 'avatar' && (
                <div>
                  <p className="text-sm text-gray-500 mb-3">아바타 이모지를 선택하거나 이미지를 업로드하세요</p>
                  {/* 미리보기 */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-3xl border-2 border-brand-300 overflow-hidden">
                      {selectedAvatar?.startsWith('data:') || selectedAvatar?.startsWith('http') ? (
                        <img src={selectedAvatar} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        selectedAvatar || currentUser.nickname[0].toUpperCase()
                      )}
                    </div>
                  </div>
                  {/* 이미지 업로드 버튼 */}
                  <div className="mb-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-brand-400 hover:text-brand-600 transition text-sm cursor-pointer"
                    >
                      📁 PC에서 이미지 선택 (최대 2MB)
                    </button>
                  </div>
                  {/* 이모지 그리드 */}
                  <div className="grid grid-cols-6 gap-2 mb-4">
                    <button
                      onClick={() => setSelectedAvatar('')}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition cursor-pointer ${
                        selectedAvatar === ''
                          ? 'bg-brand-500 text-white ring-2 ring-brand-400'
                          : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                      }`}
                    >
                      {currentUser.nickname[0].toUpperCase()}
                    </button>
                    {AVATAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setSelectedAvatar(emoji)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition cursor-pointer ${
                          selectedAvatar === emoji
                            ? 'bg-brand-100 ring-2 ring-brand-400 scale-110'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleAvatarSave}
                    className="w-full py-2 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition cursor-pointer"
                  >
                    저장
                  </button>
                </div>
              )}

              {/* 비밀번호 변경 탭 */}
              {profileTab === 'password' && (
                pwSuccess ? (
                  <p className="text-green-600 text-center font-semibold py-6">✅ 비밀번호가 변경되었습니다!</p>
                ) : (
                  <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">현재 비밀번호</label>
                      <input
                        type="password"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        placeholder="현재 비밀번호"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-brand-400"
                        maxLength={30}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">새 비밀번호</label>
                      <input
                        type="password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="새 비밀번호"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-brand-400"
                        maxLength={30}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">새 비밀번호 확인</label>
                      <input
                        type="password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="새 비밀번호 재입력"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-brand-400"
                        maxLength={30}
                      />
                    </div>
                    {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                    <div className="flex gap-2 mt-1">
                      <button type="button" onClick={closeModal} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm cursor-pointer">취소</button>
                      <button type="submit" disabled={pwLoading} className="flex-1 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-sm font-semibold disabled:opacity-60 cursor-pointer">
                        {pwLoading ? '변경 중...' : '변경하기'}
                      </button>
                    </div>
                  </form>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
