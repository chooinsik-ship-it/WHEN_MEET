'use client';

import React from 'react';

/**
 * 요일 배열 (월~일)
 */
const DAYS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

/**
 * 시간 배열 (0~23시)
 */
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface OverlapGridProps {
  schedule1: boolean[][];
  schedule2: boolean[][];
  allSchedules?: boolean[][][]; // 모든 시간표 (본인 포함)
}

/**
 * OverlapGrid 컴포넌트
 * - 여러 사용자의 시간표를 겹쳐서 표시
 * - 겹침 레벨에 따라 색상 구분:
 *   0 = 모두 여유 (흰색)
 *   1명 바쁨 = 연한 노란색
 *   2명 바쁨 = 주황색
 *   3명 이상 바쁨 = 빨간색
 */
export default function OverlapGrid({ schedule1, schedule2, allSchedules }: OverlapGridProps) {
  /**
   * 겹침 레벨 계산 (여러 명 고려)
   */
  const getOverlapLevel = (day: number, hour: number): number => {
    if (allSchedules && allSchedules.length > 0) {
      // 모든 시간표에서 해당 시간에 바쁜 사람 수 계산
      return allSchedules.filter(schedule => schedule[day][hour]).length;
    }
    
    // 기본 2명 비교
    const count = (schedule1[day][hour] ? 1 : 0) + (schedule2[day][hour] ? 1 : 0);
    return count;
  };

  const totalPeople = allSchedules ? allSchedules.length : 2;

  /**
   * 겹침 레벨에 따른 배경색 클래스 반환
   */
  const getColorClass = (level: number): string => {
    if (level === 0) return 'bg-white'; // 모두 여유
    if (level === 1) return 'bg-yellow-100'; // 1명만 바쁨
    if (level === 2) return 'bg-orange-200'; // 2명 바쁨
    if (level >= 3) return 'bg-red-300'; // 3명 이상 바쁨
    return 'bg-white';
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-bold mb-4 text-black">
        시간표 비교 ({totalPeople}명)
      </h2>
      
      {/* 범례 */}
      <div className="mb-4 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-300"></div>
          <span className="text-black">모두 여유</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border border-gray-300"></div>
          <span className="text-black">1명 바쁨</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-200 border border-gray-300"></div>
          <span className="text-black">2명 바쁨</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-300 border border-gray-300"></div>
          <span className="text-black">3명 이상 바쁨</span>
        </div>
      </div>
      
      <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-0 border border-gray-300">
        {/* 헤더: 시간 표시 */}
        <div className="bg-gray-100 border-b border-r border-gray-300 p-2 text-center font-semibold text-black text-xs">
          요일 / 시간
        </div>
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="bg-gray-100 border-b border-r border-gray-300 p-1 text-center text-xs font-semibold text-black"
          >
            {hour}
          </div>
        ))}

        {/* 각 요일별 행 */}
        {DAYS.map((day, dayIdx) => (
          <React.Fragment key={day}>
            {/* 요일 라벨 */}
            <div className="bg-gray-100 border-b border-r border-gray-300 p-2 text-center font-semibold text-sm text-black">
              {day}
            </div>
            
            {/* 시간 칸들 - 겹침 레벨에 따라 색상 표시 */}
            {HOURS.map((hour, hourIdx) => {
              const overlapLevel = getOverlapLevel(dayIdx, hourIdx);
              const colorClass = getColorClass(overlapLevel);
              
              return (
                <div
                  key={`${dayIdx}-${hourIdx}`}
                  className={`
                    border-b border-r border-gray-300 
                    aspect-square
                    ${colorClass}
                  `}
                  title={`${overlapLevel}명 바쁨`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
