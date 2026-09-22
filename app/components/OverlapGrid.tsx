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
  participantNames?: string[];
}

/**
 * OverlapGrid 컴포넌트
 * - 여러 사용자의 시간표를 겹쳐서 표시
 * - 겹침 레벨에 따라 색상 구분:
 *   0 = 모두 여유 (흰색)
 *   1명 바쁨 = 연한 초록색
 *   2명 바쁨 = 중간 초록색
 *   3명 이상 바쁨 = 진한 초록색
 */
export default function OverlapGrid({ schedule1, schedule2, allSchedules, participantNames }: OverlapGridProps) {
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
   * 해당 시간에 바쁜 사람 이름 목록 계산
   */
  const getBusyPeopleNames = (day: number, hour: number): string[] => {
    if (allSchedules && allSchedules.length > 0) {
      return allSchedules
        .map((schedule, index) => ({ schedule, index }))
        .filter(({ schedule }) => schedule[day][hour])
        .map(({ index }) => participantNames?.[index] || `참여자${index + 1}`);
    }

    const names = participantNames && participantNames.length >= 2
      ? participantNames
      : ['참여자1', '참여자2'];

    const busyPeople: string[] = [];
    if (schedule1[day][hour]) busyPeople.push(names[0]);
    if (schedule2[day][hour]) busyPeople.push(names[1]);
    return busyPeople;
  };

  const getCellTitle = (day: number, hour: number): string => {
    const busyPeopleNames = getBusyPeopleNames(day, hour);

    if (busyPeopleNames.length === 0) {
      return '모두 여유';
    }

    return busyPeopleNames.join(', ');
  };

  /**
   * 겹침 레벨에 따른 배경색 클래스 반환 (초록색 계열)
   */
  const getColorClass = (level: number): string => {
    if (level === 0) return 'bg-white'; // 모두 여유
    if (level === 1) return 'bg-green-100'; // 1명만 바쁨 (연한 초록)
    if (level === 2) return 'bg-green-300'; // 2명 바쁨 (중간 초록)
    if (level >= 3) return 'bg-green-500'; // 3명 이상 바쁨 (진한 초록)
    return 'bg-white';
  };

  return (
    <div className="w-full">
      {/* 범례 */}
      <div className="mb-4 flex flex-wrap gap-x-3 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-3.5 h-3.5 flex-shrink-0 bg-white border border-gray-300"></div>
          <span className="text-black text-xs">모두 여유</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-3.5 h-3.5 flex-shrink-0 bg-green-100 border border-gray-300"></div>
          <span className="text-black text-xs">1명 바쁨</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-3.5 h-3.5 flex-shrink-0 bg-green-300 border border-gray-300"></div>
          <span className="text-black text-xs">2명 바쁨</span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="w-3.5 h-3.5 flex-shrink-0 bg-green-500 border border-gray-300"></div>
          <span className="text-black text-xs">3명 이상 바쁨</span>
        </div>
      </div>
      
      {/* 겹침 칸 (모바일/데스크탑 공통) */}
      {(() => {
        const cell = (dayIdx: number, hourIdx: number, compact: boolean) => (
          <div
            key={`${dayIdx}-${hourIdx}`}
            className={`border-b border-r border-gray-300 ${compact ? 'min-h-[28px]' : 'aspect-square'} ${getColorClass(getOverlapLevel(dayIdx, hourIdx))}`}
            title={getCellTitle(dayIdx, hourIdx)}
          />
        );

        return (
          <>
            {/* 데스크탑: 요일 = 행, 시간 = 열 */}
            <div className="hidden sm:block overflow-x-auto">
              <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-0 border border-gray-300 min-w-[700px]">
                <div className="bg-gray-100 border-b border-r border-gray-300 p-2 text-center font-semibold text-black text-xs">
                  요일
                </div>
                {HOURS.map((hour) => (
                  <div key={hour} className="bg-gray-100 border-b border-r border-gray-300 p-1 text-center text-xs font-semibold text-black">
                    {hour}
                  </div>
                ))}

                {DAYS.map((day, dayIdx) => (
                  <React.Fragment key={day}>
                    <div className="bg-gray-100 border-b border-r border-gray-300 p-2 text-center font-semibold text-xs text-black">
                      {day}
                    </div>
                    {HOURS.map((_, hourIdx) => cell(dayIdx, hourIdx, false))}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* 모바일: 시간 = 행, 요일 = 열 → 7일이 한 화면에 들어온다 */}
            <div className="sm:hidden max-h-[60dvh] overflow-y-auto rounded-lg border border-gray-300">
              <div className="grid grid-cols-[38px_repeat(7,1fr)] gap-0">
                <div className="sticky top-0 left-0 z-20 bg-gray-100 border-b border-r border-gray-300 py-1.5 text-center text-[10px] font-semibold text-black">
                  시간
                </div>
                {DAYS.map((day) => (
                  <div key={day} className="sticky top-0 z-10 bg-gray-100 border-b border-r border-gray-300 py-1.5 text-center text-[11px] font-semibold text-black">
                    {day.replace('요일', '')}
                  </div>
                ))}

                {HOURS.map((hour) => (
                  <React.Fragment key={hour}>
                    <div className="sticky left-0 z-10 bg-gray-100 border-b border-r border-gray-300 py-1 text-center text-[10px] font-semibold text-black tabular-nums">
                      {hour}시
                    </div>
                    {DAYS.map((_, dayIdx) => cell(dayIdx, hour, true))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
