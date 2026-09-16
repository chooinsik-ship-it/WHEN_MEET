/**
 * 한글 자모 분해 및 추리 판정
 *
 * 모든 한글 음절을 "기본 자음 14 + 기본 모음 10 = 24자모"로만 분해한다.
 * 복합모음(ㅐ, ㅘ …), 쌍자음(ㄲ …), 겹받침(ㄺ …)은 기본 자모의 나열로 펼친다.
 */

/** 기본 자음 14 */
export const BASIC_CONSONANTS = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

/** 기본 모음 10 */
export const BASIC_VOWELS = [
  'ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ',
] as const;

/** 화면 키보드에 노출되는 24자모 */
export const BASIC_JAMO: string[] = [...BASIC_CONSONANTS, ...BASIC_VOWELS];

const BASIC_SET = new Set(BASIC_JAMO);

/** 유니코드 한글 음절 조합 순서 */
const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];
const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/**
 * 복합 자모 → 기본 자모 분해표
 * 쌍자음·복합모음·겹받침을 모두 같은 규칙으로 펼친다.
 */
export const COMPOUND_JAMO: Record<string, string[]> = {
  // 쌍자음
  'ㄲ': ['ㄱ', 'ㄱ'],
  'ㄸ': ['ㄷ', 'ㄷ'],
  'ㅃ': ['ㅂ', 'ㅂ'],
  'ㅆ': ['ㅅ', 'ㅅ'],
  'ㅉ': ['ㅈ', 'ㅈ'],
  // 겹받침
  'ㄳ': ['ㄱ', 'ㅅ'],
  'ㄵ': ['ㄴ', 'ㅈ'],
  'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'],
  'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'],
  'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'],
  // 복합모음
  'ㅐ': ['ㅏ', 'ㅣ'],
  'ㅒ': ['ㅑ', 'ㅣ'],
  'ㅔ': ['ㅓ', 'ㅣ'],
  'ㅖ': ['ㅕ', 'ㅣ'],
  'ㅘ': ['ㅗ', 'ㅏ'],
  'ㅙ': ['ㅗ', 'ㅏ', 'ㅣ'],
  'ㅚ': ['ㅗ', 'ㅣ'],
  'ㅝ': ['ㅜ', 'ㅓ'],
  'ㅞ': ['ㅜ', 'ㅓ', 'ㅣ'],
  'ㅟ': ['ㅜ', 'ㅣ'],
  'ㅢ': ['ㅡ', 'ㅣ'],
};

/** 자모 하나를 기본 자모 배열로 펼친다. */
function expandJamo(jamo: string): string[] {
  if (BASIC_SET.has(jamo)) return [jamo];
  const mapped = COMPOUND_JAMO[jamo];
  if (mapped) return mapped;
  return [];
}

/** 기본 24자모인지 */
export function isBasicJamo(ch: string): boolean {
  return BASIC_SET.has(ch);
}

/**
 * 문자열을 기본 자모 배열로 분해한다.
 * 완성형 음절, 낱자 자모를 모두 처리하고 그 외 문자는 무시한다.
 *
 * 예) '사과' → ['ㅅ','ㅏ','ㄱ','ㅗ','ㅏ']
 */
export function decomposeJamo(text: string): string[] {
  const out: string[] = [];

  for (const ch of text) {
    const code = ch.charCodeAt(0);

    // 완성형 음절 (가 ~ 힣)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const index = code - 0xac00;
      const cho = Math.floor(index / 588);
      const jung = Math.floor((index % 588) / 28);
      const jong = index % 28;

      out.push(...expandJamo(CHOSEONG[cho]));
      out.push(...expandJamo(JUNGSEONG[jung]));
      if (jong > 0) out.push(...expandJamo(JONGSEONG[jong]));
      continue;
    }

    // 낱자 자모 (ㄱ ~ ㅣ)
    if (code >= 0x3131 && code <= 0x3163) {
      out.push(...expandJamo(ch));
    }
    // 그 외(공백·기호 등)는 무시
  }

  return out;
}

/** 각 칸 판정 결과 */
export type Mark = 'correct' | 'present' | 'absent';

/**
 * 추측 자모와 정답 자모를 비교해 칸별 상태를 판정한다.
 *
 * 1) 위치까지 같은 자리를 먼저 correct 로 확정한다.
 * 2) 남은 정답 자모 개수만큼만 present 를 부여한다.
 *    → 정답에 없는 자모, 정답 개수를 초과한 중복 입력은 absent.
 */
export function judgeGuess(guess: string[], answer: string[]): Mark[] {
  const marks: Mark[] = new Array(guess.length).fill('absent');
  const remaining = new Map<string, number>();

  // 1단계: 초록 확정
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) {
      marks[i] = 'correct';
    } else {
      remaining.set(answer[i], (remaining.get(answer[i]) ?? 0) + 1);
    }
  }

  // 2단계: 남은 개수만큼만 노랑
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'correct') continue;
    const left = remaining.get(guess[i]) ?? 0;
    if (left > 0) {
      marks[i] = 'present';
      remaining.set(guess[i], left - 1);
    }
  }

  return marks;
}

/** 판정 결과를 공유용 이모지로 변환 */
export function marksToEmoji(marks: Mark[]): string {
  return marks
    .map((m) => (m === 'correct' ? '🟩' : m === 'present' ? '🟨' : '⬜'))
    .join('');
}

/** 접근성 라벨 (색상만으로 구분하지 않도록) */
export const MARK_LABEL: Record<Mark, string> = {
  correct: '정확',
  present: '위치 다름',
  absent: '없음',
};

/** 보조 기호 (색맹 대응) */
export const MARK_SYMBOL: Record<Mark, string> = {
  correct: '●',
  present: '▲',
  absent: '×',
};
