/**
 * 단어 사전 (서버 전용)
 *
 * ⚠️ 이 모듈은 API 라우트에서만 import 한다.
 *    클라이언트 컴포넌트에서 import 하면 정답 목록이 번들에 포함되어 게임이 무의미해진다.
 *
 * 단어 데이터는 `words.data.ts` (자동 생성). 출처·재생성 방법은 README_WORDGAME.md 참고.
 *  - ANSWER_WORDS  : 출제되는 정답 후보 (비교적 자주 쓰이는 단어)
 *  - ALLOWED_WORDS : 입력이 허용되는 단어 (사전에 있는 한글 단어 전체)
 */
import { createHash } from 'crypto';
import { decomposeJamo } from '../hangul';
import { JAMO_COUNT } from './config';
import { ALLOWED_WORDS, ANSWER_WORDS } from './words.data';

export interface DictionaryEntry {
  wordId: string;
  word: string;
  jamo: string[];
  /** 자모를 이어붙인 형태 — 입력 대조용 키 */
  jamoKey: string;
}

/**
 * 단어 ID는 단어 문자열에서 결정적으로 생성한다.
 * 사전에 단어를 추가·삭제해도 기존 단어의 ID가 바뀌지 않아 랭킹이 갈라지지 않는다.
 */
export function wordIdFor(word: string): string {
  return 'w' + createHash('sha1').update(word, 'utf8').digest('hex').slice(0, 12);
}

function buildEntries(words: readonly string[], jamoCount: number): DictionaryEntry[] {
  const seen = new Set<string>();
  const entries: DictionaryEntry[] = [];

  for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);

    const jamo = decomposeJamo(word);
    if (jamo.length !== jamoCount) continue;

    entries.push({ wordId: wordIdFor(word), word, jamo, jamoKey: jamo.join('') });
  }

  return entries;
}

/** 현재 규칙에 맞는 정답 후보 */
const ANSWER_ENTRIES = buildEntries(ANSWER_WORDS, JAMO_COUNT);

/** 현재 규칙에 맞는 입력 허용 단어 (정답 후보를 포함하는 상위 집합) */
const ALLOWED_ENTRIES = buildEntries([...ALLOWED_WORDS, ...ANSWER_WORDS], JAMO_COUNT);

const BY_ID = new Map(ALLOWED_ENTRIES.map((e) => [e.wordId, e]));

const BY_JAMO_KEY = new Map<string, DictionaryEntry>();
for (const entry of ALLOWED_ENTRIES) {
  // 자모 분해가 같은 단어가 여럿이면 먼저 등록된 단어를 대표로 둔다 (표시용)
  if (!BY_JAMO_KEY.has(entry.jamoKey)) BY_JAMO_KEY.set(entry.jamoKey, entry);
}

/** 정답 후보 전체 (서버 전용) */
export function allEntries(): DictionaryEntry[] {
  return ANSWER_ENTRIES;
}

/** 정답 후보 수 */
export function entryCount(): number {
  return ANSWER_ENTRIES.length;
}

/** 입력 허용 단어 수 */
export function allowedCount(): number {
  return ALLOWED_ENTRIES.length;
}

export function getEntryById(wordId: string): DictionaryEntry | undefined {
  return BY_ID.get(wordId);
}

/**
 * 입력한 자모 배열이 사전에 실제로 존재하는 단어인지 확인한다.
 * (자모 입력 방식이므로 "분해 결과가 일치하는 단어가 있는가"로 검증한다)
 */
export function findByJamo(jamo: string[]): DictionaryEntry | undefined {
  return BY_JAMO_KEY.get(jamo.join(''));
}
