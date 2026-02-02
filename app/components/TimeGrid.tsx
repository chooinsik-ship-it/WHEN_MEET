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
   * 전체 스케줄 초기화
   */
  const clearAll = () => {
    const emptySchedule = Array(7).fill(null).map(() => Array(24).fill(false));
    onChange(emptySchedule);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-black">{title}</h2>
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
        >
          전체 초기화
        </button>
      </div>
      
      <div 
        ref={gridRef}
        className="select-none touch-none"
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
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
              
              {/* 시간 칸들 */}
              {HOURS.map((hour, hourIdx) => {
                const isBusy = schedule[dayIdx][hourIdx];
                return (
                  <div
                    key={`${dayIdx}-${hourIdx}`}
                    data-day={dayIdx}
                    data-hour={hourIdx}
                    className={`
                      border-b border-r border-gray-300 
                      cursor-pointer 
                      transition-colors
                      hover:opacity-80
                      aspect-square
                      ${isBusy ? 'bg-green-400' : 'bg-white'}
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
      
      <div className="mt-2 text-sm text-black">
        💡 팁: 마우스로 드래그하여 일정을 표시하거나 지울 수 있습니다.
      </div>
    </div>
  );
}
