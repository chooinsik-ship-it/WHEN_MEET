'use client';

import { useState } from 'react';

interface User {
  id: number;
  nickname: string;
  location?: string;
}

interface SimpleLoginProps {
  onLogin: (user: User) => void;
  onLogout: () => void;
  currentUser: User | null;
}

/**
 * 간단한 닉네임 로그인 컴포넌트
 */
export default function SimpleLogin({ onLogin, onLogout, currentUser }: SimpleLoginProps) {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 비밀번호 변경 모달
  const [showPasswordModal, setShowPasswordModal] = useState(false);
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
        setShowPasswordModal(false);
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        setPwSuccess(false);
      }, 1500);
    } catch {
      setPwError('서버 오류가 발생했습니다.');
    } finally {
      setPwLoading(false);
    }
  };

  const closeModal = () => {
    setShowPasswordModal(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setPwSuccess(false);
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
            className="px-4 sm:px-6 py-2 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition whitespace-nowrap disabled:opacity-60 text-sm sm:text-base"
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
      <div className="flex items-center gap-3 bg-gray-100 px-4 py-2 rounded-lg">
        <button
          onClick={() => setShowPasswordModal(true)}
          title="비밀번호 변경"
          className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold hover:bg-brand-600 transition cursor-pointer"
        >
          {currentUser.nickname[0].toUpperCase()}
        </button>
        <div className="flex flex-col">
          <span className="font-medium text-black">{currentUser.nickname}</span>
          {currentUser.location && (
            <span className="text-xs text-gray-600">📍 {currentUser.location}</span>
          )}
        </div>
        <button
          onClick={onLogout}
          className="px-3 py-1 bg-gray-300 text-black text-sm rounded hover:bg-gray-400 transition"
        >
          로그아웃
        </button>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-black mb-4">비밀번호 변경</h2>
            {pwSuccess ? (
              <p className="text-green-600 text-center font-semibold py-4">✅ 비밀번호가 변경되었습니다!</p>
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
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition text-sm font-semibold disabled:opacity-60"
                  >
                    {pwLoading ? '변경 중...' : '변경하기'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
