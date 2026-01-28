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

  /**
   * 드래그 시작
   * - 시작 셀의 상태를 확인하여 dragMode 결정
   */
  const handlePointerDown = (dayIdx: number, hourIdx: number) => {
    const currentValue = schedule[dayIdx][hourIdx];
    // 현재 셀이 false(여유)면 true로 설정하는 모드, 반대의 경우 false로 설정
    const newMode = !currentValue;
    
    setIsDragging(true);
    setDragMode(newMode);
    
    // 시작 셀 즉시 토글
    toggleCell(dayIdx, hourIdx, newMode);
  };

  /**
   * 드래그 중 셀 위로 이동
   */
  const handlePointerEnter = (dayIdx: number, hourIdx: number) => {
    if (isDragging && dragMode !== null) {
      toggleCell(dayIdx, hourIdx, dragMode);
    }
  };

  /**
   * 드래그 종료
   */
  const handlePointerUp = () => {
    setIsDragging(false);
    setDragMode(null);
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
        <h2 className="text-xl font-bold">{title}</h2>
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
        >
          전체 초기화
        </button>
      </div>
      
      <div 
        ref={gridRef}
        className="select-none"
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
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
              
              {/* 시간 칸들 */}
              {HOURS.map((hour, hourIdx) => {
                const isBusy = schedule[dayIdx][hourIdx];
                return (
                  <div
                    key={`${dayIdx}-${hourIdx}`}
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
      
      <div className="mt-2 text-sm text-gray-600">
        💡 팁: 마우스로 드래그하여 일정을 표시하거나 지울 수 있습니다.
      </div>
    </div>
  );
}
