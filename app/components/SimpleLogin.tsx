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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.');
      return;
    }

    // 닉네임을 해시하여 고유 ID 생성 (간단한 해시)
    const id = nickname.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    onLogin({
      id: Math.abs(id),
      nickname: nickname.trim(),
    });

    setNickname('');
  };

  if (!currentUser) {
    return (
      <form onSubmit={handleLogin} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임 입력"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-black"
            maxLength={20}
          />
          <button
            type="submit"
            className="px-6 py-2 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 transition whitespace-nowrap"
          >
            시작하기
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-gray-100 px-4 py-2 rounded-lg">
      <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold">
        {currentUser.nickname[0].toUpperCase()}
      </div>
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
  );
}
