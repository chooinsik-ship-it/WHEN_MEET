'use client';

import { useState } from 'react';

interface User {
  id: number;
  nickname: string;
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
      <form onSubmit={handleLogin} className="flex items-center gap-2">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임을 입력하세요"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
          maxLength={20}
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
        >
          시작하기
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-gray-100 px-4 py-2 rounded-lg">
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
        {currentUser.nickname[0].toUpperCase()}
      </div>
      <span className="font-medium text-black">{currentUser.nickname}</span>
      <button
        onClick={onLogout}
        className="px-3 py-1 bg-gray-300 text-black text-sm rounded hover:bg-gray-400 transition"
      >
        로그아웃
      </button>
    </div>
  );
}
