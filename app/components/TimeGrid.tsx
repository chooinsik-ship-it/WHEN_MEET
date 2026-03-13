'use client';

import React, { useState, useRef } from 'react';

/**
 * 요일 배열 (월~일)
 */
const DAYS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

/**
 * 시간 배열 (0~23시)
 */
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TimeGridProps {
  schedule: boolean[][];
  onChange: (newSchedule: boolean[][]) => void;
  title: string;
}

/**
 * TimeGrid 컴포넌트
 * - 7일 x 24시간 그리드를 렌더링
 * - 드래그로 일정 설정/해제 가능
 * - true = 바쁨(초록색), false = 여유(흰색)
 */
export default function TimeGrid({ schedule, onChange, title }: TimeGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<boolean | null>(null); // true=set, false=unset
  const gridRef = useRef<HTMLDivElement>(null);
  const lastCell = useRef<{ day: number; hour: number } | null>(null); // 마지막 셀 좌표

  /**
   * 두 점 사이의 모든 셀을 채우는 함수 (선 그리기)
   */
  const fillCellsBetween = (
    fromDay: number,
    fromHour: number,
    toDay: number,
    toHour: number,
    value: boolean
  ) => {
    const cells: Array<[number, number]> = [];
    
    // 같은 셀이면 해당 셀만 추가
    if (fromDay === toDay && fromHour === toHour) {
      cells.push([toDay, toHour]);
    } else {
      // 선형 보간으로 중간 셀들 계산
      const steps = Math.max(Math.abs(toDay - fromDay), Math.abs(toHour - fromHour));
      
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const day = Math.round(fromDay + (toDay - fromDay) * t);
        const hour = Math.round(fromHour + (toHour - fromHour) * t);
        cells.push([day, hour]);
      }
    }
    
    // 중복 제거 및 적용
    const newSchedule = schedule.map((day, dIdx) =>
      day.map((hour, hIdx) => {
        const shouldToggle = cells.some(([d, h]) => d === dIdx && h === hIdx);
        return shouldToggle ? value : schedule[dIdx][hIdx];
      })
    );
    
    onChange(newSchedule);
  };

  /**
   * 드래그 시작
   */
  const handlePointerDown = (dayIdx: number, hourIdx: number) => {
    const currentValue = schedule[dayIdx][hourIdx];
    const newMode = !currentValue;
    
    setIsDragging(true);
    setDragMode(newMode);
    lastCell.current = { day: dayIdx, hour: hourIdx };
    
    // 시작 셀 즉시 토글
    fillCellsBetween(dayIdx, hourIdx, dayIdx, hourIdx, newMode);
  };

  /**
   * 드래그 중 셀 위로 이동
   */
  const handlePointerEnter = (dayIdx: number, hourIdx: number) => {
    if (isDragging && dragMode !== null && lastCell.current) {
      // 마지막 셀에서 현재 셀까지 모든 셀 채우기
      fillCellsBetween(
        lastCell.current.day,
        lastCell.current.hour,
        dayIdx,
        hourIdx,
        dragMode
      );
      lastCell.current = { day: dayIdx, hour: hourIdx };
    }
  };

  /**
   * 포인터 이동 처리 (빠른 드래그 대응)
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragMode === null || !lastCell.current) return;
    
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return;
    
    const dayIdx = element.getAttribute('data-day');
    const hourIdx = element.getAttribute('data-hour');
    
    if (dayIdx !== null && hourIdx !== null) {
      const day = parseInt(dayIdx);
      const hour = parseInt(hourIdx);
      
      if (lastCell.current.day !== day || lastCell.current.hour !== hour) {
        fillCellsBetween(
          lastCell.current.day,
          lastCell.current.hour,
          day,
          hour,
          dragMode
        );
        lastCell.current = { day, hour };
      }
    }
  };

  /**
   * 드래그 종료
   */
  const handlePointerUp = () => {
    setIsDragging(false);
    setDragMode(null);
    lastCell.current = null;
  };

  /**
   * 특정 셀의 값을 변경
   */
  const toggleCell = (dayIdx: number, hourIdx: number, value: boolean) => {
    const newSchedule = schedule.map((day, dIdx) =>
      day.map((hour, hIdx) => {
        if (dIdx === dayIdx && hIdx === hourIdx) {
          return value;
        }
        return hour;
      })
    );
    onChange(newSchedule);
  };

  /**
   * 전체 스케줄 초기화 (확인 후)
   */
  const clearAll = () => {
    if (confirm('정말 모두 지울까요? 이 작업은 취소할 수 없어요.')) {
      const emptySchedule = Array(7).fill(null).map(() => Array(24).fill(false));
      onChange(emptySchedule);
    }
  };

  // 바쁜 시간 개수 계산
  const busyCount = schedule.flat().filter(Boolean).length;

  return (
    <div className="w-full">
      {/* 빈 상태 안내 */}
      {busyCount === 0 && (
        <div className="mb-4 p-4 bg-brand-50 border-l-4 border-brand-300 rounded">
          <p className="text-sm text-brand-700">
            ✨ 아직 표시된 일정이 없어요. <span className="font-bold">드래그로 바쁜 시간을 칠해보세요!</span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-black">{title}</h2>
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200"
        >
          초기화
        </button>
      </div>

      {/* 범례 */}
      <div className="mb-3 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
          <span className="text-gray-700">여유</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 border border-gray-300 rounded"></div>
          <span className="text-gray-700">바쁨 (일정 있음)</span>
        </div>
      </div>
      
      <div 
        ref={gridRef}
        className="select-none touch-none overflow-auto max-h-[600px] border border-gray-300 rounded-lg"
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <div className="grid grid-cols-[100px_repeat(24,1fr)] gap-0">
          {/* 헤더: 시간 표시 (sticky) */}
          <div className="sticky top-0 left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-400 p-2 text-center font-semibold text-black text-xs">
            요일 / 시간
          </div>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="sticky top-0 z-10 bg-gray-100 border-b-2 border-r border-gray-400 p-2 text-center text-xs font-semibold text-black"
            >
              {hour}시
            </div>
          ))}

          {/* 각 요일별 행 */}
          {DAYS.map((day, dayIdx) => (
            <React.Fragment key={day}>
              {/* 요일 라벨 (sticky) */}
              <div className="sticky left-0 z-10 bg-brand-50 border-b border-r-2 border-gray-300 p-3 text-center font-bold text-sm text-brand-800">
                {day}
              </div>
              
              {/* 시간 칸들 */}
              {HOURS.map((hour, hourIdx) => {
                const isBusy = schedule[dayIdx][hourIdx];
                return (
                  <div
                    key={`${dayIdx}-${hourIdx}`}
                    data-day={dayIdx}
                    data-hour={hourIdx}
                    className={`
                      border-b border-r border-gray-200
                      cursor-pointer 
                      transition-all duration-150
                      hover:ring-2 hover:ring-brand-300 hover:z-10
                      min-h-[32px]
                      ${
                        isBusy 
                          ? 'bg-green-400 hover:bg-green-500' 
                          : 'bg-white hover:bg-gray-100'
                      }
                      ${
                        isDragging && dragMode !== null
                          ? 'cursor-grabbing'
                          : 'cursor-grab'
                      }
                    `}
                    onPointerDown={() => handlePointerDown(dayIdx, hourIdx)}
                    onPointerEnter={() => handlePointerEnter(dayIdx, hourIdx)}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-lg">🖌️</span>
          <span><span className="font-semibold text-black">드래그:</span> 칸 채우기/지우기</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-lg">👆</span>
          <span><span className="font-semibold text-black">클릭:</span> 한 칸만 토글</span>
        </div>
      </div>
    </div>
  );
}
