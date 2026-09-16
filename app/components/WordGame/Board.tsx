'use client';

import { BASIC_CONSONANTS, BASIC_VOWELS, MARK_LABEL, MARK_SYMBOL } from '../../lib/hangul';
import type { Mark } from './api';

const MARK_STYLE: Record<Mark, string> = {
  correct: 'bg-emerald-500 border-emerald-600 text-white',
  present: 'bg-amber-400 border-amber-500 text-white',
  absent: 'bg-gray-300 border-gray-400 text-gray-700',
};

const KEY_STYLE: Record<Mark, string> = {
  correct: 'bg-emerald-500 text-white border-emerald-600',
  present: 'bg-amber-400 text-white border-amber-500',
  absent: 'bg-gray-200 text-gray-400 border-gray-300',
};

interface BoardProps {
  jamoCount: number;
  maxAttempts: number;
  guesses: { jamo: string[]; marks: Mark[] }[];
  input: string[];
  /** 흔들림 애니메이션용 (입력 오류) */
  shake: boolean;
}

/** 추리 칸 */
export function Board({ jamoCount, maxAttempts, guesses, input, shake }: BoardProps) {
  const rows = Array.from({ length: maxAttempts }, (_, rowIndex) => {
    const guess = guesses[rowIndex];
    const isCurrent = rowIndex === guesses.length;
    return { rowIndex, guess, isCurrent };
  });

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2" role="grid" aria-label="추리 판">
      {rows.map(({ rowIndex, guess, isCurrent }) => (
        <div
          key={rowIndex}
          role="row"
          className={`flex gap-1.5 sm:gap-2 ${isCurrent && shake ? 'animate-[wordgame-shake_0.3s]' : ''}`}
        >
          {Array.from({ length: jamoCount }, (_, colIndex) => {
            const mark = guess?.marks[colIndex];
            const char = guess ? guess.jamo[colIndex] : isCurrent ? input[colIndex] : undefined;

            return (
              <div
                key={colIndex}
                role="gridcell"
                aria-label={
                  char
                    ? `${char}${mark ? `, ${MARK_LABEL[mark]}` : ''}`
                    : '빈 칸'
                }
                className={`relative flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl font-bold transition-colors sm:h-14 sm:w-14 sm:text-2xl ${
                  mark
                    ? MARK_STYLE[mark]
                    : char
                      ? 'border-brand-400 bg-white text-gray-900'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                }`}
              >
                {char ?? ''}
                {/* 색상만으로 구분하지 않도록 보조 기호 표시 */}
                {mark && (
                  <span className="absolute bottom-0.5 right-1 text-[10px] leading-none opacity-80">
                    {MARK_SYMBOL[mark]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface KeyboardProps {
  keyStates: Record<string, Mark>;
  disabled: boolean;
  onInput: (jamo: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
}

/** 기본 24자모 화면 키보드 */
export function Keyboard({ keyStates, disabled, onInput, onBackspace, onClear, onSubmit }: KeyboardProps) {
  const rows: string[][] = [
    BASIC_CONSONANTS.slice(0, 7) as unknown as string[],
    BASIC_CONSONANTS.slice(7) as unknown as string[],
    BASIC_VOWELS.slice(0, 5) as unknown as string[],
    BASIC_VOWELS.slice(5) as unknown as string[],
  ];

  return (
    <div className="mt-5 flex flex-col items-center gap-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap justify-center gap-1 sm:gap-1.5">
          {row.map((jamo) => {
            const state = keyStates[jamo];
            return (
              <button
                key={jamo}
                type="button"
                disabled={disabled}
                onClick={() => onInput(jamo)}
                aria-label={`${jamo}${state ? `, ${MARK_LABEL[state]}` : ''}`}
                className={`h-11 w-9 rounded-md border text-base font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:w-11 sm:text-lg ${
                  state ? KEY_STYLE[state] : 'border-gray-300 bg-white text-gray-800 hover:bg-brand-50'
                }`}
              >
                {jamo}
              </button>
            );
          })}
        </div>
      ))}

      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onBackspace}
          disabled={disabled}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← 한 칸 지우기
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          전체 삭제
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="rounded-md bg-brand-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          제출
        </button>
      </div>
    </div>
  );
}

/** 자모별 최종 상태 (초록 > 노랑 > 회색) */
export function computeKeyStates(guesses: { jamo: string[]; marks: Mark[] }[]): Record<string, Mark> {
  const priority: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
  const states: Record<string, Mark> = {};

  for (const guess of guesses) {
    guess.jamo.forEach((jamo, i) => {
      const mark = guess.marks[i];
      const current = states[jamo];
      if (!current || priority[mark] > priority[current]) states[jamo] = mark;
    });
  }
  return states;
}
