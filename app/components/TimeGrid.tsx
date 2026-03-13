'use client';

import React, { useState, useRef, useEffect } from 'react';

const DAYS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TimeGridProps {
  schedule: boolean[][];
  onChange: (newSchedule: boolean[][]) => void;
  title: string;
}

export default function TimeGrid({ schedule, onChange, title }: TimeGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<boolean | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const lastCell = useRef<{ day: number; hour: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<boolean | null>(null);

  // 상위 컴포넌트를 ref에 저장 (state 없이 native 이벤트에서 사용)
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const fillCellsBetween = (
    fromDay: number, fromHour: number,
    toDay: number, toHour: number,
    value: boolean
  ) => {
    const cells: Array<[number, number]> = [];
    if (fromDay === toDay && fromHour === toHour) {
      cells.push([toDay, toHour]);
    } else {
      const steps = Math.max(Math.abs(toDay - fromDay), Math.abs(toHour - fromHour));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        cells.push([
          Math.round(fromDay + (toDay - fromDay) * t),
          Math.round(fromHour + (toHour - fromHour) * t),
        ]);
      }
    }
    const cur = scheduleRef.current;
    const newSchedule = cur.map((day, dIdx) =>
      day.map((cell, hIdx) => {
        const hit = cells.some(([d, h]) => d === dIdx && h === hIdx);
        return hit ? value : cell;
      })
    );
    onChangeRef.current(newSchedule);
  };

  // fillRef: native 이벤트 핸들러에서 항상 최신 fillCellsBetween을 참조
  const fillRef = useRef(fillCellsBetween);
  fillRef.current = fillCellsBetween;

  // 터치 이벤트 등록 (passive: false → preventDefault 가능)
  // React 합성 이벤트는 iOS Safari에서 passive로 등록되어 스크롤을 막을 수 없음
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const getCellAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return null;
      const day = el.getAttribute('data-day');
      const hour = el.getAttribute('data-hour');
      if (day === null || hour === null) return null;
      return { day: parseInt(day), hour: parseInt(hour) };
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const cell = getCellAt(touch.clientX, touch.clientY);
      if (!cell) return; // 헤더/라벨 터치 시 스크롤 허용

      e.preventDefault(); // 터치 드래그 시 스크롤 차단
      const newMode = !scheduleRef.current[cell.day][cell.hour];
      isDraggingRef.current = true;
      dragModeRef.current = newMode;
      lastCell.current = cell;
      fillRef.current(cell.day, cell.hour, cell.day, cell.hour, newMode);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || dragModeRef.current === null) return;
      e.preventDefault();

      const touch = e.touches[0];
      const cell = getCellAt(touch.clientX, touch.clientY);
      if (!cell || !lastCell.current) return;

      if (lastCell.current.day !== cell.day || lastCell.current.hour !== cell.hour) {
        fillRef.current(
          lastCell.current.day, lastCell.current.hour,
          cell.day, cell.hour,
          dragModeRef.current
        );
        lastCell.current = cell;
      }
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      dragModeRef.current = null;
      lastCell.current = null;
    };

    grid.addEventListener('touchstart', onTouchStart, { passive: false });
    grid.addEventListener('touchmove', onTouchMove, { passive: false });
    grid.addEventListener('touchend', onTouchEnd);
    grid.addEventListener('touchcancel', onTouchEnd);

    return () => {
      grid.removeEventListener('touchstart', onTouchStart);
      grid.removeEventListener('touchmove', onTouchMove);
      grid.removeEventListener('touchend', onTouchEnd);
      grid.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []); // mount 시 1번만 등록 — 핸들러는 ref로 참조

  // 데스크탑 마우스 드래그 핸들러
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return; // 터치는 native 이벤트로 처리

    const target = e.target as HTMLElement;
    const dayAttr = target.getAttribute('data-day');
    const hourAttr = target.getAttribute('data-hour');
    if (dayAttr === null || hourAttr === null) return;

    const dayIdx = parseInt(dayAttr);
    const hourIdx = parseInt(hourAttr);
    const newMode = !schedule[dayIdx][hourIdx];

    isDraggingRef.current = true;
    dragModeRef.current = newMode;
    lastCell.current = { day: dayIdx, hour: hourIdx };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragMode(newMode);
    fillCellsBetween(dayIdx, hourIdx, dayIdx, hourIdx, newMode);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (!isDraggingRef.current || dragModeRef.current === null || !lastCell.current) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    const dayIdx = el.getAttribute('data-day');
    const hourIdx = el.getAttribute('data-hour');
    if (dayIdx === null || hourIdx === null) return;

    const day = parseInt(dayIdx);
    const hour = parseInt(hourIdx);
    if (lastCell.current.day !== day || lastCell.current.hour !== hour) {
      fillCellsBetween(lastCell.current.day, lastCell.current.hour, day, hour, dragModeRef.current);
      lastCell.current = { day, hour };
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    dragModeRef.current = null;
    lastCell.current = null;
    setIsDragging(false);
    setDragMode(null);
  };

  const clearAll = () => {
    if (confirm('정말 모두 지울까요? 이 작업은 취소할 수 없어요.')) {
      onChange(Array(7).fill(null).map(() => Array(24).fill(false)));
    }
  };

  const busyCount = schedule.flat().filter(Boolean).length;

  return (
    <div className="w-full">
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
        className="select-none overflow-auto max-h-[55vh] sm:max-h-[600px] border border-gray-300 rounded-lg"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <div className="grid grid-cols-[80px_repeat(24,1fr)] sm:grid-cols-[100px_repeat(24,1fr)] gap-0 min-w-[700px]">
          <div className="sticky top-0 left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-400 p-1 sm:p-2 text-center font-semibold text-black text-xs">
            요일
          </div>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="sticky top-0 z-10 bg-gray-100 border-b-2 border-r border-gray-400 p-2 text-center text-xs font-semibold text-black"
            >
              {hour}시
            </div>
          ))}

          {DAYS.map((day, dayIdx) => (
            <React.Fragment key={day}>
              <div className="sticky left-0 z-10 bg-brand-50 border-b border-r-2 border-gray-300 p-1 sm:p-3 text-center font-bold text-xs sm:text-sm text-brand-800">
                {day.replace('요일', '')}<span className="hidden sm:inline">요일</span>
              </div>
              {HOURS.map((_, hourIdx) => {
                const isBusy = schedule[dayIdx][hourIdx];
                return (
                  <div
                    key={`${dayIdx}-${hourIdx}`}
                    data-day={dayIdx}
                    data-hour={hourIdx}
                    style={{ touchAction: 'none' }}
                    className={`
                      border-b border-r border-gray-200
                      cursor-pointer transition-all duration-150
                      hover:ring-2 hover:ring-brand-300 hover:z-10
                      min-h-[32px]
                      ${isBusy ? 'bg-green-400 hover:bg-green-500' : 'bg-white hover:bg-gray-100'}
                      ${isDragging && dragMode !== null ? 'cursor-grabbing' : 'cursor-grab'}
                    `}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400 text-right">← 좌우로 스크롤하세요 →</p>
      <div className="mt-2 sm:mt-4 space-y-1 sm:space-y-2">
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
