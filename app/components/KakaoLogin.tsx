'use client';

import { useEffect, useState } from 'react';

// 카카오 SDK 타입 정의
declare global {
  interface Window {
    Kakao: any;
  }
}

interface User {
  id: number;
  nickname: string;
  profile_image?: string;
}

interface KakaoLoginProps {
  onLogin: (user: User) => void;
  onLogout: () => void;
  currentUser: User | null;
}

/**
 * 카카오 로그인 컴포넌트
 * - 카카오 OAuth 로그인 처리
 * - 사용자 정보 표시
 * - 로그아웃 기능
 */
export default function KakaoLogin({ onLogin, onLogout, currentUser }: KakaoLoginProps) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    let initRetryCount = 0;
    const maxInitRetries = 50; // 5초

    // 카카오 SDK 초기화
    const initKakao = () => {
      initRetryCount++;
      
      console.log(`SDK 초기화 시도 ${initRetryCount}/${maxInitRetries}`, {
        hasKakao: !!window.Kakao,
        hasAuth: !!window.Kakao?.Auth,
        hasAPI: !!window.Kakao?.API,
        allKeys: window.Kakao ? Object.keys(window.Kakao) : []
      });

      if (window.Kakao && window.Kakao.Auth) {
        if (!window.Kakao.isInitialized()) {
          const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
          if (kakaoKey && kakaoKey !== 'YOUR_KAKAO_JS_KEY') {
            window.Kakao.init(kakaoKey);
            console.log('✅ Kakao SDK 초기화 완료:', {
              isInitialized: window.Kakao.isInitialized(),
              hasAuth: !!window.Kakao.Auth,
              hasAPI: !!window.Kakao.API
            });
            setIsInitialized(true);
            checkLoginStatus();
          } else {
            console.error('❌ 카카오 JavaScript 키가 설정되지 않았습니다.');
          }
        } else {
          console.log('✅ Kakao SDK 이미 초기화됨');
          setIsInitialized(true);
          checkLoginStatus();
        }
      } else if (initRetryCount < maxInitRetries) {
        // Auth가 없으면 조금 더 대기
        setTimeout(initKakao, 100);
      } else {
        console.error('❌ Kakao SDK Auth 모듈 로드 실패', {
          hasKakao: !!window.Kakao,
          kakaoKeys: window.Kakao ? Object.keys(window.Kakao) : []
        });
        alert('카카오 SDK Auth 모듈을 불러오는데 실패했습니다. 페이지를 새로고침해주세요.');
      }
    };

    // 초기화 시작
    if (typeof window !== 'undefined') {
      initKakao();
    }
  }, []);

  /**
   * 로그인 상태 확인
   */
  const checkLoginStatus = () => {
    if (window.Kakao.Auth.getAccessToken()) {
      window.Kakao.API.request({
        url: '/v2/user/me',
        success: (response: any) => {
          const user: User = {
            id: response.id,
            nickname: response.kakao_account?.profile?.nickname || '사용자',
            profile_image: response.kakao_account?.profile?.profile_image_url,
          };
          onLogin(user);
        },
        fail: (error: any) => {
          console.error('사용자 정보 가져오기 실패:', error);
        },
      });
    }
  };

  /**
   * 카카오 로그인
   */
  const handleLogin = () => {
    if (!isInitialized || !window.Kakao) {
      alert('카카오 SDK가 아직 로딩 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (!window.Kakao.Auth) {
      alert('카카오 SDK가 제대로 로드되지 않았습니다. 페이지를 새로고침해주세요.');
      return;
    }

    window.Kakao.Auth.login({
      success: (authObj: any) => {
        console.log('로그인 성공:', authObj);
        // 로그인 성공 시 사용자 정보 가져오기
        window.Kakao.API.request({
          url: '/v2/user/me',
          success: (response: any) => {
            const user: User = {
              id: response.id,
              nickname: response.kakao_account?.profile?.nickname || '사용자',
              profile_image: response.kakao_account?.profile?.profile_image_url,
            };
            onLogin(user);
          },
          fail: (error: any) => {
            console.error('사용자 정보 가져오기 실패:', error);
            alert('사용자 정보를 가져오는데 실패했습니다.');
          },
        });
      },
      fail: (error: any) => {
        console.error('로그인 실패:', error);
        alert('로그인에 실패했습니다.');
      },
    });
  };

  /**
   * 카카오 로그아웃
   */
  const handleLogout = () => {
    if (!window.Kakao.Auth.getAccessToken()) {
      onLogout();
      return;
    }

    window.Kakao.Auth.logout(() => {
      onLogout();
    });
  };

  if (!currentUser) {
    // 로그인하지 않은 상태
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleLogin}
          disabled={!isInitialized}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.442 1.492 4.573 3.707 5.943-.07.293-.437 1.86-.5 2.107-.074.294-.024.574.165.764.138.138.323.207.507.207.138 0 .277-.034.404-.103.582-.316 2.684-1.644 3.11-1.897C10.253 17.847 11.11 18 12 18c5.523 0 10-3.477 10-7.5S17.523 3 12 3z"/>
          </svg>
          {isInitialized ? '카카오 로그인' : '로딩 중...'}
        </button>
        {!isInitialized && (
          <span className="text-sm text-gray-600">SDK 초기화 중...</span>
        )}
      </div>
    );
  }

  // 로그인한 상태
  return (
    <div className="flex items-center gap-3 bg-gray-100 px-4 py-2 rounded-lg">
      {currentUser.profile_image && (
        <img
          src={currentUser.profile_image}
          alt={currentUser.nickname}
          className="w-8 h-8 rounded-full"
        />
      )}
      <span className="font-medium text-black">{currentUser.nickname}</span>
      <button
        onClick={handleLogout}
        className="px-3 py-1 bg-gray-300 text-black text-sm rounded hover:bg-gray-400 transition"
      >
        로그아웃
      </button>
    </div>
  );
}
