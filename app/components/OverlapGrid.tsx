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
}

/**
 * OverlapGrid 컴포넌트
 * - 두 사용자의 시간표를 겹쳐서 표시
 * - 겹침 레벨에 따라 색상 구분:
 *   0 = 둘 다 여유 (흰색)
 *   1 = 한 명만 바쁨 (연한 초록)
 *   2 = 둘 다 바쁨 (진한 초록)
 */
export default function OverlapGrid({ schedule1, schedule2 }: OverlapGridProps) {
  /**
   * 겹침 레벨 계산
   * @returns 0 (둘 다 여유), 1 (한 명만 바쁨), 2 (둘 다 바쁨)
   */
  const getOverlapLevel = (dayIdx: number, hourIdx: number): number => {
    const busy1 = schedule1[dayIdx][hourIdx];
    const busy2 = schedule2[dayIdx][hourIdx];
    
    if (!busy1 && !busy2) return 0; // 둘 다 여유
    if (busy1 && busy2) return 2;   // 둘 다 바쁨
    return 1;                        // 한 명만 바쁨
  };

  /**
   * 겹침 레벨에 따른 배경색 클래스 반환
   */
  const getColorClass = (level: number): string => {
    switch (level) {
      case 0:
        return 'bg-white';           // 둘 다 여유
      case 1:
        return 'bg-green-200';       // 한 명만 바쁨 (연한 초록)
      case 2:
        return 'bg-green-500';       // 둘 다 바쁨 (진한 초록)
      default:
        return 'bg-white';
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-bold mb-4">겹침 비교</h2>
      
      <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-0 border border-gray-300">
        {/* 헤더: 시간 표시 */}
        <div className="bg-gray-100 border-b border-r border-gray-300 p-2 text-center font-semibold">
          요일 / 시간
        </div>
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="bg-gray-100 border-b border-r border-gray-300 p-1 text-center text-xs font-semibold"
          >
            {hour}
          </div>
        ))}

        {/* 각 요일별 행 */}
        {DAYS.map((day, dayIdx) => (
          <React.Fragment key={day}>
            {/* 요일 라벨 */}
            <div className="bg-gray-100 border-b border-r border-gray-300 p-2 text-center font-semibold text-sm">
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
                  title={`겹침 레벨: ${overlapLevel}`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      
      <div className="mt-4 flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white border border-gray-300"></div>
          <span>둘 다 여유</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-200 border border-gray-300"></div>
          <span>한 명만 바쁨</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-500 border border-gray-300"></div>
          <span>둘 다 바쁨</span>
        </div>
      </div>
    </div>
  );
}
