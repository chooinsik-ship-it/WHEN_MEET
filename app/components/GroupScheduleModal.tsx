'use client';

import { useEffect, useState } from 'react';
import OverlapGrid from './OverlapGrid';
import { loadSchedule, loadUser } from '../utils/storage';
import { generateRecommendation } from '../utils/recommendation';
import { addressToCoordinate, recommendSubwayStations } from '../utils/subway';

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
  const [subwayRecommendations, setSubwayRecommendations] = useState<ReturnType<typeof recommendSubwayStations>>([]);
  const [missingLocations, setMissingLocations] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadMemberSchedules();
    }
  }, [isOpen, memberNicknames]);

  const loadMemberSchedules = async () => {
    setIsLoading(true);
    
    const allMembers = [creatorNickname, ...memberNicknames];

    // 스케줄 + 거주지 동시 로드
    const [schedules, userData] = await Promise.all([
      Promise.all(allMembers.map(async (nickname) => {
        const id = nicknameToId(nickname);
        const schedule = await loadSchedule(id);
        return schedule || createEmptySchedule();
      })),
      Promise.all(allMembers.map(async (nickname) => {
        const id = nicknameToId(nickname);
        const user = await loadUser(id);
        return { nickname, location: user?.location as string | undefined };
      })),
    ]);

    setAllSchedules(schedules);

    // 거주지 기반 지하철 추천
    const locations: Array<{ lat: number; lng: number }> = [];
    const missing: string[] = [];
    userData.forEach(({ nickname, location }) => {
      if (location) {
        const coord = addressToCoordinate(location);
        if (coord) locations.push(coord);
        else missing.push(nickname);
      } else {
        missing.push(nickname);
      }
    });

    setMissingLocations(missing);
    if (locations.length >= 2) {
      setSubwayRecommendations(recommendSubwayStations(locations, 5));
    } else {
      setSubwayRecommendations([]);
    }

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
                  <span className="px-3 py-1 bg-brand-500 text-white text-sm rounded-full font-semibold">
                    {creatorNickname} (생성자)
                  </span>
                  {memberNicknames.map((nickname, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-brand-100 text-brand-700 text-sm rounded-full"
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
                participantNames={[creatorNickname, ...memberNicknames]}
              />

              {/* 추천 문구 */}
              {recommendation && (
                <div className="mt-6 p-4 bg-brand-50 border-l-4 border-brand-400 rounded">
                  <h3 className="text-lg font-bold text-black mb-2">
                    만남 추천
                  </h3>
                  <p className="text-black">{recommendation}</p>
                </div>
              )}

              {/* 지하철역 추천 */}
              {subwayRecommendations.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-500 rounded">
                  <h3 className="text-lg font-bold text-black mb-3">🚇 중간 지점 지하철역 추천</h3>
                  <div className="space-y-2">
                    {subwayRecommendations.map((station, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-bold text-black">{station.name}</p>
                            <p className="text-sm text-gray-600">{station.line}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">평균 거리</p>
                          <p className="font-semibold text-green-600">{station.avgDistance.toFixed(1)}km</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">💡 모든 멤버의 거주지를 고려한 중간 지점입니다</p>
                </div>
              )}

              {/* 거주지 정보 부족 */}
              {subwayRecommendations.length === 0 && missingLocations.length > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                  <h3 className="text-lg font-bold text-black mb-2">📍 거주지 정보가 필요해요</h3>
                  <p className="text-sm text-gray-700">
                    거주지 미입력 멤버: <span className="font-semibold">{missingLocations.join(', ')}</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-1">모든 멤버가 거주지를 입력하면 중간 지점을 추천해드려요!</p>
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
