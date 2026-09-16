/**
 * 단어 사전 생성 스크립트
 *
 * 공개 사전을 내려받아 app/lib/wordgame/words.data.ts 를 생성한다.
 * 실행: npm run build:dictionary
 *
 * 출처
 *  - 명사 목록: open-korean-text (Apache License 2.0)
 *      https://github.com/open-korean-text/open-korean-text
 *      → 실제로 번들에 포함되는 단어 데이터
 *  - 빈도 순위: hermitdave/FrequencyWords (MIT, OpenSubtitles 말뭉치 기반)
 *      https://github.com/hermitdave/FrequencyWords
 *      → "어떤 단어를 정답으로 낼지" 고르는 데만 사용하고, 빈도 수치 자체는 번들에 넣지 않는다
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OKT = 'https://raw.githubusercontent.com/open-korean-text/open-korean-text/master/src/main/resources/org/openkoreantext/processor/util/noun';
const FREQ = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ko/ko_50k.txt';

/** 정답으로 낼 단어를 고르는 빈도 상위 범위 */
const ANSWER_FREQ_RANK = 20000;

/** 사람이 직접 고른 기본 단어 (빈도 목록에 없어도 정답 후보로 유지) */
const CURATED = `
가방 가슴 가위 가을 감자 거울 겨울 경기 고민 공기 공부 과자 교실 구름 국수 그림 그늘 근처 기름 기분
김치 까치 꼬리 남자 노래 노을 녹차 놀이 농구 다방 단추 담요 도장 독서 라면 마늘 마당 마음 만두 먼지
메모 모래 미술 바람 박수 반지 배구 배추 버섯 벼락 보물 봄비 부엌 분수 사과 사람 사진 사탕 살구 상자
서울 세수 소금 소설 수건 수박 수업 순서 숫자 스승 시간 시계 시골 시장 식구 실수 아들 아빠 아침 양파
어제 엄마 여름 연기 엽서 영어 오늘 오빠 온도 외투 용기 우산 의자 이름 이불 일기 자연 잔디 재미 저녁
제비 조개 종이 주말 주방 지갑 지붕 차례 채소 천사 청소 초록 추억 축구 취미 치과 친구 키위 탁구 터널
토끼 파랑 편지 표정 하늘 학교 항구 향기 호박 혼자 회사 흐름
`.trim().split(/\s+/);

async function fetchLines(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패 ${res.status}: ${url}`);
  const text = await res.text();
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const { decomposeJamo } = await import(
    new URL('../app/lib/hangul.ts', import.meta.url).href
  );

  console.log('사전 다운로드 중…');
  // 입력 허용 범위를 더 넓히고 싶다면 `${OKT}/wikipedia_title_nouns.txt` 를 추가한다.
  // 다만 위키백과 표제어에는 고유명사·음역어(예: 킷지, 필츠)가 많아 "실제 단어" 느낌이 옅어진다.
  const [nouns, foreign, profane, slangs, freqLines] = await Promise.all([
    fetchLines(`${OKT}/nouns.txt`),
    fetchLines(`${OKT}/foreign.txt`),
    fetchLines(`${OKT}/profane.txt`).catch(() => []),
    fetchLines(`${OKT}/slangs.txt`).catch(() => []),
    fetchLines(FREQ),
  ]);

  const freqRank = new Map();
  freqLines.forEach((line, i) => {
    const word = line.split(' ')[0];
    if (!freqRank.has(word)) freqRank.set(word, i);
  });

  const blocked = new Set([...profane, ...slangs]);
  const isWord = (w) => /^[가-힣]+$/.test(w) && w.length >= 1 && w.length <= 4;

  /** 입력으로 허용할 단어: 실제 사전에 있는 한글 단어 전부 */
  const allowed = new Set();
  for (const word of [...nouns, ...foreign, ...CURATED]) {
    if (isWord(word)) allowed.add(word);
  }

  /** 정답 후보: 허용 단어 중 빈도 상위권 + 직접 고른 단어 (비속어 제외) */
  const answers = new Set(CURATED.filter(isWord));
  for (const word of allowed) {
    if (blocked.has(word)) continue;
    const rank = freqRank.get(word);
    if (rank !== undefined && rank < ANSWER_FREQ_RANK) answers.add(word);
  }
  for (const word of blocked) answers.delete(word);

  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  const answerList = sorted(answers);
  const allowedList = sorted(allowed);

  // 자모 길이 분포 (참고용)
  const dist = {};
  for (const w of allowedList) {
    const n = decomposeJamo(w).length;
    dist[n] = (dist[n] ?? 0) + 1;
  }

  const chunk = (list) =>
    list
      .map((w) => `'${w}'`)
      .reduce((acc, item, i) => {
        if (i % 12 === 0) acc.push([]);
        acc[acc.length - 1].push(item);
        return acc;
      }, [])
      .map((row) => '  ' + row.join(', ') + ',')
      .join('\n');

  const content = `/* eslint-disable */
/**
 * 자동 생성 파일 — 직접 수정하지 말 것.
 * 재생성: npm run build:dictionary  (scripts/build-dictionary.mjs)
 *
 * 단어 데이터 출처: open-korean-text (Apache License 2.0)
 *   https://github.com/open-korean-text/open-korean-text
 *   Copyright 2014 Twitter, Inc. and other contributors
 *   Licensed under the Apache License, Version 2.0
 *
 * 정답 후보 선별에는 hermitdave/FrequencyWords (MIT) 의 한국어 빈도 순위를 사용했다.
 * 빈도 수치 자체는 이 파일에 포함되지 않는다.
 *
 * 생성 시각: ${new Date().toISOString()}
 * 허용 단어 ${allowedList.length}개 / 정답 후보 ${answerList.length}개
 * 자모 길이 분포: ${JSON.stringify(dist)}
 */

/** 정답으로 출제되는 단어 (비교적 자주 쓰이는 단어) */
export const ANSWER_WORDS: string[] = [
${chunk(answerList)}
];

/** 입력이 허용되는 단어 (사전에 있는 한글 단어 전체) */
export const ALLOWED_WORDS: string[] = [
${chunk(allowedList)}
];
`;

  const out = join(here, '..', 'app', 'lib', 'wordgame', 'words.data.ts');
  writeFileSync(out, content, 'utf8');

  console.log(`생성 완료: ${out}`);
  console.log(`  허용 단어 ${allowedList.length}개, 정답 후보 ${answerList.length}개`);
  console.log(`  자모 길이 분포: ${JSON.stringify(dist)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
