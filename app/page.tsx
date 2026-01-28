'use client';

import { useState } from 'react';
import TimeGrid from './components/TimeGrid';
import OverlapGrid from './components/OverlapGrid';
import { generateRecommendation } from './utils/recommendation';

/**
 * 빈 스케줄 초기화 함수
 * @returns 7일 x 24시간 배열 (모두 false = 여유)
 */
function createEmptySchedule(): boolean[][] {
  return Array(7).fill(null).map(() => Array(24).fill(false));
}

export default function Home() {
  // 더미 사용자 2명의 스케줄 상태 관리
  const [schedule1, setSchedule1] = useState<boolean[][]>(createEmptySchedule());
  const [schedule2, setSchedule2] = useState<boolean[][]>(createEmptySchedule());
  
  // 현재 활성화된 탭 (user1, user2, compare)
  const [activeTab, setActiveTab] = useState<'user1' | 'user2' | 'compare'>('user1');

  // 추천 문구 생성
  const recommendation = generateRecommendation(schedule1, schedule2);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            시간표 겹치기 & 추천
          </h1>
          <p className="text-gray-600">
            두 사람의 시간표를 입력하고 공통 여유 시간을 찾아보세요
          </p>
        </header>

        {/* 탭 네비게이션 */}
        <div className="flex gap-2 mb-6 border-b border-gray-300">
          <button
            onClick={() => setActiveTab('user1')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'user1'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            사용자 1
          </button>
          <button
            onClick={() => setActiveTab('user2')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'user2'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            사용자 2
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'compare'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            비교 및 추천
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {activeTab === 'user1' && (
            <TimeGrid
              schedule={schedule1}
              onChange={setSchedule1}
              title="사용자 1의 시간표"
            />
          )}

          {activeTab === 'user2' && (
            <TimeGrid
              schedule={schedule2}
              onChange={setSchedule2}
              title="사용자 2의 시간표"
            />
          )}

          {activeTab === 'compare' && (
            <div>
              <OverlapGrid schedule1={schedule1} schedule2={schedule2} />
              
              {/* 추천 문구 표시 */}
              <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                <h3 className="text-lg font-bold text-blue-800 mb-2">
                  만남 추천
                </h3>
                <p className="text-blue-900">{recommendation}</p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>Made with Next.js + Tailwind CSS</p>
        </footer>
      </div>
    </div>
  );
}
