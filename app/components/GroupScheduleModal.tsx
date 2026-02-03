'use client';

import { useEffect, useState } from 'react';
import OverlapGrid from './OverlapGrid';
import { loadSchedule } from '../utils/storage';
import { generateRecommendation } from '../utils/recommendation';

interface GroupScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  memberNicknames: string[];
  creatorNickname: string;
}

/**
 * 빈 스케줄 초기화 함수
 */
function createEmptySchedule(): boolean[][] {
  return Array(7).fill(null).map(() => Array(24).fill(false));
}

/**
 * 닉네임을 해시하여 ID 생성
 */
function nicknameToId(nickname: string): number {
  const hash = nickname.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return Math.abs(hash);
}

export default function GroupScheduleModal({
  isOpen,
  onClose,
  groupName,
  memberNicknames,
  creatorNickname,
}: GroupScheduleModalProps) {
  const [allSchedules, setAllSchedules] = useState<boolean[][][]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadMemberSchedules();
    }
  }, [isOpen, memberNicknames]);

  const loadMemberSchedules = async () => {
    setIsLoading(true);
    
    // 생성자 + 멤버들의 스케줄 불러오기
    const allMembers = [creatorNickname, ...memberNicknames];
    const schedules = await Promise.all(
      allMembers.map(async (nickname) => {
        const id = nicknameToId(nickname);
        const schedule = await loadSchedule(id);
        return schedule || createEmptySchedule();
      })
    );
    
    setAllSchedules(schedules);
    setIsLoading(false);
  };

  const recommendation = allSchedules.length > 0
    ? generateRecommendation(allSchedules)
    : '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-black">{groupName}</h2>
            <p className="text-sm text-gray-500 mt-1">
              생성자: {creatorNickname} | 멤버: {memberNicknames.length}명
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">스케줄을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 멤버 목록 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-black mb-3">참여 멤버</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-500 text-white text-sm rounded-full font-semibold">
                    {creatorNickname} (생성자)
                  </span>
                  {memberNicknames.map((nickname, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                    >
                      {nickname}
                    </span>
                  ))}
                </div>
              </div>

              {/* 겹치는 스케줄 표시 */}
              <OverlapGrid
                schedule1={allSchedules[0] || createEmptySchedule()}
                schedule2={allSchedules[1] || createEmptySchedule()}
                allSchedules={allSchedules}
              />

              {/* 추천 문구 */}
              {recommendation && (
                <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                  <h3 className="text-lg font-bold text-black mb-2">
                    만남 추천
                  </h3>
                  <p className="text-black">{recommendation}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
