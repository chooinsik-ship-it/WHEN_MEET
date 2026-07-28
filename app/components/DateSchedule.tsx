'use client';

import React, { useState, useRef, useEffect } from 'react';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

interface DateFriend {
  id: number;
  nickname: string;
  dateSchedule: Record<string, boolean>;
}

interface DateScheduleProps {
  schedule: Record<string, boolean>;
  onChange: (newSchedule: Record<string, boolean>) => void;
  friends: DateFriend[];
  selectedFriendIds: number[];
  onToggleFriend: (id: number) => void;
  /** 상위 화면(친구 목록 등)에 이미 친구 선택 UI가 있을 때 내부 칩 목록을 숨김 */
  showFriendPicker?: boolean;
}

export default function DateSchedule({
  schedule,
  onChange,
  friends,
  selectedFriendIds,
  onToggleFriend,
  showFriendPicker = true,
}: DateScheduleProps) {
  const today = new Date();
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [editMode, setEditMode] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<boolean | null>(null);
  const lastCellRef = useRef<{ row: number; col: number } | null>(null);
  const editModeRef = useRef(false);
  editModeRef.current = editMode;

  // 최신 schedule/onChange를 ref에 저장 (native 이벤트 핸들러에서 사용)
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const selectedFriends = friends.filter((f) => selectedFriendIds.includes(f.id));

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const numRows = Math.ceil(cells.length / 7);
  // row/col -> day number (or null for empty leading/trailing slots)
  const dayGrid: (number | null)[][] = Array.from({ length: numRows }, (_, r) =>
    cells.slice(r * 7, r * 7 + 7)
  );
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const dayGridRef = useRef(dayGrid);
  dayGridRef.current = dayGrid;
  const viewYearRef = useRef(viewYear);
  viewYearRef.current = viewYear;
  const viewMonthRef = useRef(viewMonth);
  viewMonthRef.current = viewMonth;

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const fillCellsBetween = (
    fromRow: number, fromCol: number,
    toRow: number, toCol: number,
    value: boolean
  ) => {
    const grid = dayGridRef.current;
    const year = viewYearRef.current;
    const month = viewMonthRef.current;
    const positions: Array<[number, number]> = [];
    if (fromRow === toRow && fromCol === toCol) {
      positions.push([toRow, toCol]);
    } else {
      const steps = Math.max(Math.abs(toRow - fromRow), Math.abs(toCol - fromCol));
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        positions.push([
          Math.round(fromRow + (toRow - fromRow) * t),
          Math.round(fromCol + (toCol - fromCol) * t),
        ]);
      }
    }
    const updated = { ...scheduleRef.current };
    positions.forEach(([r, c]) => {
      const day = grid[r]?.[c];
      if (day == null) return;
      const dateKey = formatDateKey(year, month, day);
      if (value) updated[dateKey] = true;
      else delete updated[dateKey];
    });
    onChangeRef.current(updated);
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
      const row = el.getAttribute('data-row');
      const col = el.getAttribute('data-col');
      if (row === null || col === null) return null;
      return { row: parseInt(row), col: parseInt(col) };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!editModeRef.current) return;
      const touch = e.touches[0];
      const cell = getCellAt(touch.clientX, touch.clientY);
      if (!cell) return;

      e.preventDefault();
      const day = dayGridRef.current[cell.row]?.[cell.col];
      if (day == null) return;
      const dateKey = formatDateKey(viewYearRef.current, viewMonthRef.current, day);
      const newMode = !scheduleRef.current[dateKey];
      isDraggingRef.current = true;
      dragModeRef.current = newMode;
      lastCellRef.current = cell;
      fillRef.current(cell.row, cell.col, cell.row, cell.col, newMode);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!editModeRef.current || !isDraggingRef.current || dragModeRef.current === null) return;
      e.preventDefault();
      const touch = e.touches[0];
      const cell = getCellAt(touch.clientX, touch.clientY);
      if (!cell || !lastCellRef.current) return;
      if (lastCellRef.current.row !== cell.row || lastCellRef.current.col !== cell.col) {
        fillRef.current(lastCellRef.current.row, lastCellRef.current.col, cell.row, cell.col, dragModeRef.current);
        lastCellRef.current = cell;
      }
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      dragModeRef.current = null;
      lastCellRef.current = null;
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const target = e.target as HTMLElement;
    const rowAttr = target.getAttribute('data-row');
    const colAttr = target.getAttribute('data-col');
    if (rowAttr === null || colAttr === null) return;

    const row = parseInt(rowAttr);
    const col = parseInt(colAttr);
    const day = dayGrid[row]?.[col];
    if (day == null) return;
    const dateKey = formatDateKey(viewYear, viewMonth, day);
    const newMode = !schedule[dateKey];

    isDraggingRef.current = true;
    dragModeRef.current = newMode;
    lastCellRef.current = { row, col };
    e.currentTarget.setPointerCapture(e.pointerId);
    fillCellsBetween(row, col, row, col, newMode);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (!isDraggingRef.current || dragModeRef.current === null || !lastCellRef.current) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    const rowAttr = el.getAttribute('data-row');
    const colAttr = el.getAttribute('data-col');
    if (rowAttr === null || colAttr === null) return;

    const row = parseInt(rowAttr);
    const col = parseInt(colAttr);
    if (lastCellRef.current.row !== row || lastCellRef.current.col !== col) {
      fillCellsBetween(lastCellRef.current.row, lastCellRef.current.col, row, col, dragModeRef.current);
      lastCellRef.current = { row, col };
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    dragModeRef.current = null;
    lastCellRef.current = null;
  };

  const busyFriendNames = (dateKey: string) =>
    selectedFriends.filter((f) => f.dateSchedule[dateKey]).map((f) => f.nickname);

  // 이번 달 중 오늘 이후이면서 나와 선택된 친구 모두 일정이 없는 날 = 추천 여유일
  const freeDays = cells
    .filter((day): day is number => day !== null)
    .filter((day) => new Date(viewYear, viewMonth, day) >= todayAtMidnight)
    .filter((day) => {
      const dateKey = formatDateKey(viewYear, viewMonth, day);
      return !schedule[dateKey] && busyFriendNames(dateKey).length === 0;
    });

  return (
    <div className="w-full max-w-md mx-auto">
      {showFriendPicker && friends.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">👥 같이 비교할 친구</p>
          <div className="flex flex-wrap gap-1.5">
            {friends.map((f) => {
              const isSelected = selectedFriendIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => onToggleFriend(f.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-orange-400 text-white border-orange-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {f.nickname}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrevMonth}
          className="px-2 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer text-sm"
        >
          ◀
        </button>
        <h2 className="text-base font-bold text-black">
          {viewYear}년 {viewMonth + 1}월
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`sm:hidden px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer ${
              editMode
                ? 'bg-brand-500 text-white border-brand-600 shadow-md'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {editMode ? '✏️ 편집중' : '✏️ 편집'}
          </button>
          <button
            onClick={goNextMonth}
            className="px-2 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer text-sm"
          >
            ▶
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-2">
        드래그(모바일은 ✏️ 편집 모드에서)로 일정 있는 날짜를 칠하거나 지우세요. 나와 선택된 친구 모두 비어있는 날이 여유일로 추천돼요.
      </p>

      <div
        ref={gridRef}
        className={`grid grid-cols-7 gap-0.5 mb-4 select-none rounded-lg transition-all duration-200 ${
          editMode ? 'ring-2 ring-brand-300' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-[10px] font-semibold py-1 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}
          >
            {label}
          </div>
        ))}
        {cells.map((day, idx) => {
          const row = Math.floor(idx / 7);
          const col = idx % 7;
          if (day === null) return <div key={`empty-${idx}`} />;
          const dateKey = formatDateKey(viewYear, viewMonth, day);
          const isMyBusy = !!schedule[dateKey];
          const busyFriends = busyFriendNames(dateKey);
          const isFriendBusy = busyFriends.length > 0;
          const isToday = dateKey === todayKey;
          const dow = new Date(viewYear, viewMonth, day).getDay();

          let cellClass = dow === 0 ? 'text-red-500 hover:bg-gray-100' : dow === 6 ? 'text-blue-500 hover:bg-gray-100' : 'text-gray-700 hover:bg-gray-100';
          if (isMyBusy && isFriendBusy) cellClass = 'bg-purple-500 text-white';
          else if (isMyBusy) cellClass = 'bg-red-400 text-white';
          else if (isFriendBusy) cellClass = 'bg-orange-300 text-white';
          else if (isToday) cellClass = 'bg-brand-100 text-brand-700 ring-2 ring-brand-300';

          const title = busyFriends.length > 0 ? `${busyFriends.join(', ')} 일정 있음` : undefined;

          return (
            <div
              key={dateKey}
              data-row={row}
              data-col={col}
              title={title}
              style={{ touchAction: 'none' }}
              className={`aspect-square rounded-md flex items-center justify-center text-xs font-semibold transition cursor-pointer ${cellClass}`}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-red-400 rounded"></div>
          <span>내 일정</span>
        </div>
        {friends.length > 0 && (
          <>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-orange-300 rounded"></div>
              <span>친구 일정</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-purple-500 rounded"></div>
              <span>둘 다</span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-brand-100 ring-2 ring-brand-300 rounded"></div>
          <span>오늘</span>
        </div>
      </div>

      <div className="p-3 bg-brand-50 border-l-4 border-brand-300 rounded">
        <p className="text-xs font-semibold text-brand-700 mb-1">✨ 추천 여유일</p>
        {freeDays.length > 0 ? (
          <p className="text-xs text-gray-700">
            {freeDays.map((day) => `${day}일(${DAY_LABELS[new Date(viewYear, viewMonth, day).getDay()]})`).join(', ')}
          </p>
        ) : (
          <p className="text-xs text-gray-500">이번 달에는 추천할 여유일이 없어요.</p>
        )}
      </div>
    </div>
  );
}
