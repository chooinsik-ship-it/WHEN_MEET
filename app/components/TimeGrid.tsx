'use client';

import React, { useState, useRef, useEffect } from 'react';

const DAYS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);



interface TimeGridProps {
  schedule: boolean[][];
  onChange: (newSchedule: boolean[][]) => void;
  title: string;
  appointments?: { day: number; startHour: number; endHour: number; name: string; id: string; status?: string }[];
  onAppointmentClick?: (apptId: string) => void;
}

export default function TimeGrid({ schedule, onChange, title, appointments = [], onAppointmentClick }: TimeGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<boolean | null>(null);
  const [editMode, setEditMode] = useState(false); // 모바일 편집 모드 토글
  const gridRef = useRef<HTMLDivElement>(null);
  const lastCell = useRef<{ day: number; hour: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<boolean | null>(null);
  const editModeRef = useRef(false);
  editModeRef.current = editMode;

  // 최신 schedule/onChange/onAppointmentClick를 ref에 저장 (native 이벤트 핸들러에서 사용)
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onAppointmentClickRef = useRef(onAppointmentClick);
  onAppointmentClickRef.current = onAppointmentClick;

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

  const fillRef = useRef(fillCellsBetween);
  fillRef.current = fillCellsBetween;

  // 터치 이벤트 등록 (passive: false → preventDefault 가능)
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

      // 약속 칸 터치 → 약속 클릭 핸들러 호출 (편집 모드 여부와 무관)
      const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const apptId = target?.getAttribute('data-appt-id');
      if (apptId) {
        e.preventDefault();
        onAppointmentClickRef.current?.(apptId);
        return;
      }

      // 편집 모드가 아니면 스크롤 허용
      if (!editModeRef.current) return;

      const cell = getCellAt(touch.clientX, touch.clientY);
      if (!cell) return;

      e.preventDefault();
      const newMode = !scheduleRef.current[cell.day][cell.hour];
      isDraggingRef.current = true;
      dragModeRef.current = newMode;
      lastCell.current = cell;
      fillRef.current(cell.day, cell.hour, cell.day, cell.hour, newMode);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!editModeRef.current || !isDraggingRef.current || dragModeRef.current === null) return;
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
  }, []);

  // 데스크탑 마우스 드래그 핸들러
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;

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

  /**
   * 칸 하나. 모바일(세로형)·데스크탑(가로형) 레이아웃이 같은 셀을 공유한다.
   * 드래그 로직은 data-day/data-hour 만 보므로 배치가 달라져도 그대로 동작한다.
   */
  const renderCell = (dayIdx: number, hourIdx: number, compact: boolean) => {
    const isBusy = schedule[dayIdx][hourIdx];
    const appt = appointments.find(
      a => a.day === dayIdx && hourIdx >= a.startHour && hourIdx < a.endHour
    );
    const isPending = appt?.status === 'pending';

    return (
      <div
        key={`${dayIdx}-${hourIdx}`}
        data-day={dayIdx}
        data-hour={hourIdx}
        data-appt-id={appt ? appt.id : undefined}
        style={{ touchAction: 'none' }}
        title={appt
          ? isPending
            ? `${appt.name} (대기 중 - 참여자 수락 필요)`
            : `${appt.name} (클릭하여 수정/취소)`
          : undefined}
        onPointerDown={appt ? (e) => e.stopPropagation() : undefined}
        onClick={appt && onAppointmentClick ? (e) => { e.stopPropagation(); onAppointmentClick(appt.id); } : undefined}
        className={`
          border-b border-r border-gray-200
          transition-all duration-150
          hover:ring-2 hover:z-10
          ${compact ? 'min-h-[26px]' : 'min-h-[32px]'}
          ${appt
            ? isPending
              ? 'bg-yellow-200 hover:bg-yellow-300 hover:ring-yellow-300 cursor-pointer'
              : 'bg-blue-500 hover:bg-blue-400 hover:ring-blue-300 cursor-pointer'
            : isBusy
              ? 'bg-green-400 hover:bg-green-500 hover:ring-brand-300'
              : 'bg-white hover:bg-gray-100 hover:ring-brand-300'}
        `}
      />
    );
  };

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
        <div className="flex items-center gap-2">
          {/* 모바일 편집 모드 토글 (스크롤 ↔ 그리기 전환) */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`sm:hidden px-3 py-2 rounded-lg border text-sm font-semibold transition-all duration-200 cursor-pointer ${
              editMode
                ? 'bg-brand-500 text-white border-brand-600 shadow-md'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {editMode ? '✏️ 편집중' : '✏️ 편집'}
          </button>
          <button
            onClick={clearAll}
            className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200 cursor-pointer"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 모바일 편집 모드 안내 */}
      <div className="sm:hidden mb-2">
        {editMode ? (
          <p className="text-xs text-brand-600 bg-brand-50 border border-brand-200 rounded px-3 py-1.5">
            ✏️ <span className="font-semibold">편집 모드</span> — 드래그로 칸을 채우세요. 완료 후 ✏️ 버튼을 다시 눌러 스크롤 모드로 전환하세요.
          </p>
        ) : (
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
            👆 <span className="font-semibold">스크롤 모드</span> — 시간표를 넘기려면 스크롤하세요. 칸을 채우려면 <span className="font-semibold text-brand-600">✏️ 편집</span> 버튼을 누르세요.
          </p>
        )}
      </div>

      <div className="mb-3 flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
          <span className="text-gray-700">여유</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 border border-gray-300 rounded"></div>
          <span className="text-gray-700">바쁨 (일정 있음)</span>
        </div>        {appointments.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 border border-gray-300 rounded"></div>
            <span className="text-gray-700">확정 약속</span>
          </div>
        )}
        {appointments.some(a => a.status === 'pending') && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-200 border border-gray-300 rounded"></div>
            <span className="text-gray-700">대기 중 (미수락)</span>
          </div>
        )}      </div>

      <div
        ref={gridRef}
        className={`select-none overflow-auto max-h-[60dvh] sm:max-h-[600px] rounded-lg transition-all duration-200 ${
          editMode
            ? 'border-2 border-brand-400 ring-2 ring-brand-200'
            : 'border border-gray-300'
        }`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        {/* 데스크탑: 요일 = 행, 시간 = 열 */}
        <div className="hidden sm:grid sm:grid-cols-[100px_repeat(24,1fr)] gap-0 min-w-[700px]">
          <div className="sticky top-0 left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-400 p-2 text-center font-semibold text-black text-xs">
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
              <div className="sticky left-0 z-10 bg-brand-50 border-b border-r-2 border-gray-300 p-3 text-center font-bold text-sm text-brand-800">
                {day}
              </div>
              {HOURS.map((_, hourIdx) => renderCell(dayIdx, hourIdx, false))}
            </React.Fragment>
          ))}
        </div>

        {/* 모바일: 시간 = 행, 요일 = 열 → 가로 스크롤 없이 7일이 한 화면에 들어온다 */}
        <div className="grid grid-cols-[38px_repeat(7,1fr)] gap-0 sm:hidden">
          <div className="sticky top-0 left-0 z-20 bg-gray-100 border-b-2 border-r-2 border-gray-400 py-1.5 text-center text-[10px] font-semibold text-black">
            시간
          </div>
          {DAYS.map((day) => (
            <div
              key={day}
              className="sticky top-0 z-10 bg-gray-100 border-b-2 border-r border-gray-400 py-1.5 text-center text-[11px] font-semibold text-black"
            >
              {day.replace('요일', '')}
            </div>
          ))}

          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              <div className="sticky left-0 z-10 bg-brand-50 border-b border-r-2 border-gray-300 py-1 text-center text-[10px] font-bold text-brand-800 tabular-nums">
                {hour}시
              </div>
              {DAYS.map((_, dayIdx) => renderCell(dayIdx, hour, true))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400 text-right">
        <span className="sm:hidden">↕ 위아래로 스크롤하세요</span>
        <span className="hidden sm:inline">← 좌우로 스크롤하세요 →</span>
      </p>
      <div className="mt-2 sm:mt-4 space-y-1 sm:space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-lg">🖌️</span>
          <span className="hidden sm:inline"><span className="font-semibold text-black">드래그:</span> 칸 채우기/지우기</span>
          <span className="sm:hidden"><span className="font-semibold text-black">편집 모드에서</span> 드래그로 채우기</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-lg">👆</span>
          <span><span className="font-semibold text-black">클릭:</span> 한 칸만 토글</span>
        </div>
      </div>
    </div>
  );
}
