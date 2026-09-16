/**
 * 단어 게임 순수 로직 테스트
 * 실행: npm run test:wordgame  (node --test, 타입 스트리핑 사용)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { decomposeJamo, judgeGuess, marksToEmoji, BASIC_JAMO } from '../app/lib/hangul.ts';
import {
  buildRanking,
  buildWordRanking,
  compareRows,
  isEligible,
  missingForEligibility,
  type RankRow,
} from '../app/lib/wordgame/rankings.ts';
import {
  bucketsFor,
  periodStartTs,
  seoulDateString,
  seoulMonthString,
  seoulWeekStart,
} from '../app/lib/wordgame/time.ts';
import type { WordResultEntry } from '../app/lib/wordgame/types.ts';

/* ------------------------------------------------------------ 자모 분해 */

test('키보드는 기본 자모 24개', () => {
  assert.equal(BASIC_JAMO.length, 24);
});

test('기본 음절 분해', () => {
  assert.deepEqual(decomposeJamo('사과'), ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ']);
  assert.deepEqual(decomposeJamo('학교'), ['ㅎ', 'ㅏ', 'ㄱ', 'ㄱ', 'ㅛ']);
});

test('복합모음 분해: ㅐ → ㅏ+ㅣ, ㅔ → ㅓ+ㅣ', () => {
  assert.deepEqual(decomposeJamo('배'), ['ㅂ', 'ㅏ', 'ㅣ']);
  assert.deepEqual(decomposeJamo('베'), ['ㅂ', 'ㅓ', 'ㅣ']);
  assert.deepEqual(decomposeJamo('과'), ['ㄱ', 'ㅗ', 'ㅏ']);
  assert.deepEqual(decomposeJamo('의'), ['ㅇ', 'ㅡ', 'ㅣ']);
  assert.deepEqual(decomposeJamo('왜'), ['ㅇ', 'ㅗ', 'ㅏ', 'ㅣ']);
});

test('쌍자음 분해: ㄲ → ㄱ+ㄱ', () => {
  assert.deepEqual(decomposeJamo('까'), ['ㄱ', 'ㄱ', 'ㅏ']);
  assert.deepEqual(decomposeJamo('밖'), ['ㅂ', 'ㅏ', 'ㄱ', 'ㄱ']);
});

test('겹받침 분해: ㄺ → ㄹ+ㄱ, ㅄ → ㅂ+ㅅ', () => {
  assert.deepEqual(decomposeJamo('닭'), ['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ']);
  assert.deepEqual(decomposeJamo('값'), ['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ']);
});

test('분해 결과는 항상 기본 24자모로만 구성된다', () => {
  const samples = ['꽃잎', '괜찮다', '읽었다', '왜냐하면', '쌍둥이', '밟다', '없다'];
  for (const word of samples) {
    for (const jamo of decomposeJamo(word)) {
      assert.ok(BASIC_JAMO.includes(jamo), `${word}: ${jamo} 는 기본 자모가 아님`);
    }
  }
});

test('한글이 아닌 문자는 무시한다', () => {
  assert.deepEqual(decomposeJamo('가 A1!'), ['ㄱ', 'ㅏ']);
});

/* -------------------------------------------------------------- 판정 */

test('전부 정확하면 모두 correct', () => {
  const answer = ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ'];
  assert.deepEqual(judgeGuess(answer, answer), ['correct', 'correct', 'correct', 'correct', 'correct']);
});

test('위치가 다르면 present', () => {
  const answer = ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ'];
  const guess = ['ㄱ', 'ㅗ', 'ㅅ', 'ㅏ', 'ㅏ'];
  assert.deepEqual(judgeGuess(guess, answer), ['present', 'present', 'present', 'present', 'correct']);
});

test('정답에 없는 자모는 absent', () => {
  const answer = ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ'];
  const guess = ['ㅎ', 'ㅑ', 'ㅌ', 'ㅕ', 'ㅍ'];
  assert.deepEqual(judgeGuess(guess, answer), ['absent', 'absent', 'absent', 'absent', 'absent']);
});

test('중복 자모: 남은 개수만큼만 노랑, 초과분은 회색', () => {
  // 정답에 ㅏ 가 2개 (1번, 4번 칸)
  const answer = ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ'];
  // 입력의 ㅏ 3개는 모두 위치가 어긋남 → 2개만 present, 나머지 1개는 absent
  const guess = ['ㅏ', 'ㅓ', 'ㅏ', 'ㅏ', 'ㅓ'];

  assert.deepEqual(judgeGuess(guess, answer), [
    'present',
    'absent',
    'present',
    'absent',
    'absent',
  ]);
});

test('중복 자모: 위치가 맞는 칸이 노랑을 가져가지 않는다', () => {
  // 정답의 ㅏ 2개를 입력도 같은 자리에 맞혔으므로 남은 ㅏ 는 0개
  const answer = ['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ'];
  const guess = ['ㅏ', 'ㅏ', 'ㅏ', 'ㅗ', 'ㅏ'];

  assert.deepEqual(judgeGuess(guess, answer), [
    'absent',
    'correct',
    'absent',
    'correct',
    'correct',
  ]);
});

test('중복 자모: 정답 개수를 넘는 입력은 초과분만 absent', () => {
  const answer = ['ㄱ', 'ㄱ', 'ㅏ', 'ㅏ', 'ㅅ'];
  const guess = ['ㄱ', 'ㄱ', 'ㄱ', 'ㄱ', 'ㅅ'];
  assert.deepEqual(judgeGuess(guess, answer), ['correct', 'correct', 'absent', 'absent', 'correct']);
});

test('초록 우선 판정: 뒤쪽이 정확하면 앞쪽 중복은 노랑이 되지 않는다', () => {
  const answer = ['ㄴ', 'ㅏ', 'ㅁ', 'ㅜ', 'ㅏ'];
  const guess = ['ㅏ', 'ㅓ', 'ㅓ', 'ㅓ', 'ㅏ'];
  const marks = judgeGuess(guess, answer);
  assert.equal(marks[4], 'correct');
  assert.equal(marks[0], 'present', '정답에 ㅏ 가 2개이므로 하나는 present');
});

test('공유용 이모지 변환', () => {
  assert.equal(marksToEmoji(['correct', 'present', 'absent']), '🟩🟨⬜');
});

/* ------------------------------------------------------- 기간 (KST) */

test('KST 날짜 경계', () => {
  // 2026-09-16 00:30 KST = 2026-09-15 15:30 UTC
  const ts = Date.UTC(2026, 8, 15, 15, 30);
  assert.equal(seoulDateString(ts), '2026-09-16');
  // 2026-09-15 23:30 KST = 2026-09-15 14:30 UTC
  assert.equal(seoulDateString(Date.UTC(2026, 8, 15, 14, 30)), '2026-09-15');
});

test('주간은 월요일 시작', () => {
  // 2026-09-16(수) → 그 주 월요일 2026-09-14
  assert.equal(seoulWeekStart(Date.UTC(2026, 8, 16, 3, 0)), '2026-09-14');
  // 일요일 2026-09-20 → 같은 주 월요일 2026-09-14
  assert.equal(seoulWeekStart(Date.UTC(2026, 8, 20, 3, 0)), '2026-09-14');
  // 월요일 2026-09-21 00:30 KST → 2026-09-21
  assert.equal(seoulWeekStart(Date.UTC(2026, 8, 20, 15, 30)), '2026-09-21');
});

test('월간 키', () => {
  assert.equal(seoulMonthString(Date.UTC(2026, 8, 30, 15, 30)), '2026-10');
});

test('버킷은 전체·일·주·월 4개', () => {
  const buckets = bucketsFor(Date.UTC(2026, 8, 16, 3, 0));
  assert.deepEqual(buckets, ['all', 'd:2026-09-16', 'w:2026-09-14', 'm:2026-09']);
});

test('periodStartTs 는 KST 자정을 UTC 로 반환', () => {
  const now = Date.UTC(2026, 8, 16, 3, 0); // 2026-09-16 12:00 KST
  assert.equal(periodStartTs('today', now), Date.UTC(2026, 8, 15, 15, 0));
  assert.equal(periodStartTs('week', now), Date.UTC(2026, 8, 13, 15, 0)); // 9/14 00:00 KST
  assert.equal(periodStartTs('month', now), Date.UTC(2026, 7, 31, 15, 0)); // 9/1 00:00 KST
  assert.equal(periodStartTs('all', now), 0);
});

/* ------------------------------------------------------- 종합 랭킹 */

function row(partial: Partial<RankRow> & { userId: number }): RankRow {
  return {
    nickname: `u${partial.userId}`,
    finished: 20,
    success: 10,
    winRate: 0.5,
    avgAttempts: 3,
    avgDurationMs: 60_000,
    maxStreak: 3,
    firstRecordedAt: 1000,
    metric: null,
    ...partial,
  } as RankRow;
}

test('최소 참여 조건: 성공률은 종료 10회 이상', () => {
  assert.equal(isEligible('winRate', { finished: 9, success: 9 }), false);
  assert.equal(isEligible('winRate', { finished: 10, success: 1 }), true);
});

test('최소 참여 조건: 평균 시도/시간은 성공 10회 이상', () => {
  assert.equal(isEligible('avgAttempts', { finished: 100, success: 9 }), false);
  assert.equal(isEligible('avgTime', { finished: 10, success: 10 }), true);
});

test('조건 미달이면 남은 게임 수를 알려준다', () => {
  assert.deepEqual(missingForEligibility('winRate', { finished: 4, success: 2 }), {
    need: 6,
    kind: 'finished',
  });
  assert.equal(missingForEligibility('winRate', { finished: 10, success: 2 }), null);
});

test('총 성공 횟수 랭킹은 내림차순', () => {
  const ranked = buildRanking('success', [
    row({ userId: 1, success: 5 }),
    row({ userId: 2, success: 12 }),
    row({ userId: 3, success: 9 }),
  ]);
  assert.deepEqual(ranked.map((r) => r.userId), [2, 3, 1]);
});

test('평균 시도 랭킹은 오름차순', () => {
  const ranked = buildRanking('avgAttempts', [
    row({ userId: 1, avgAttempts: 3.5 }),
    row({ userId: 2, avgAttempts: 2.1 }),
  ]);
  assert.deepEqual(ranked.map((r) => r.userId), [2, 1]);
});

test('동률이면 성공률 → 평균 시도 → 평균 시간 → 먼저 달성한 순', () => {
  const ranked = buildRanking('success', [
    row({ userId: 1, success: 10, winRate: 0.5, avgAttempts: 3, firstRecordedAt: 500 }),
    row({ userId: 2, success: 10, winRate: 0.8, avgAttempts: 4, firstRecordedAt: 900 }),
    row({ userId: 3, success: 10, winRate: 0.5, avgAttempts: 2, firstRecordedAt: 700 }),
    row({ userId: 4, success: 10, winRate: 0.5, avgAttempts: 3, firstRecordedAt: 100 }),
  ]);
  // 2(성공률 최고) → 3(성공률 동률, 평균 시도 최소) → 4(먼저 달성) → 1
  assert.deepEqual(ranked.map((r) => r.userId), [2, 3, 4, 1]);
});

test('완전 동률이면 userId 로 안정 정렬 (페이지네이션 흔들림 방지)', () => {
  const same = { success: 10, winRate: 0.5, avgAttempts: 3, avgDurationMs: 1000, firstRecordedAt: 100 };
  const a = buildRanking('success', [row({ userId: 7, ...same }), row({ userId: 3, ...same })]);
  const b = buildRanking('success', [row({ userId: 3, ...same }), row({ userId: 7, ...same })]);
  assert.deepEqual(a.map((r) => r.userId), [3, 7]);
  assert.deepEqual(b.map((r) => r.userId), [3, 7]);
});

test('이미 사용한 기준은 동점 처리에서 생략한다', () => {
  // winRate 랭킹에서 winRate 가 같으면 다음 기준(평균 시도)으로 넘어간다
  const ranked = buildRanking('winRate', [
    row({ userId: 1, winRate: 0.7, avgAttempts: 4 }),
    row({ userId: 2, winRate: 0.7, avgAttempts: 2 }),
  ]);
  assert.deepEqual(ranked.map((r) => r.userId), [2, 1]);
});

test('compareRows 는 null metric 을 뒤로 보낸다', () => {
  const a = row({ userId: 1, metric: null });
  const b = row({ userId: 2, metric: 5 });
  assert.ok(compareRows('success', a, b) > 0);
});

/* ---------------------------------------------------- 단어별 랭킹 */

function result(partial: Partial<WordResultEntry> & { userId: number }): WordResultEntry {
  return {
    status: 'SUCCESS',
    attemptsUsed: 3,
    durationMs: 60_000,
    endedAt: 1_000_000,
    gameId: `g${partial.userId}`,
    ...partial,
  } as WordResultEntry;
}

test('단어별 랭킹: 성공만, 시도 → 시간 → 먼저 성공 순', () => {
  const { rows } = buildWordRanking(
    [
      result({ userId: 1, attemptsUsed: 3, durationMs: 10_000 }),
      result({ userId: 2, attemptsUsed: 2, durationMs: 90_000 }),
      result({ userId: 3, attemptsUsed: 2, durationMs: 30_000 }),
      result({ userId: 4, status: 'FAILED', attemptsUsed: 5 }),
      result({ userId: 5, status: 'ABANDONED', attemptsUsed: 1 }),
    ],
    'all'
  );

  assert.deepEqual(rows.map((r) => r.userId), [3, 2, 1]);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
});

test('단어별 랭킹: 시도·시간이 같으면 먼저 성공한 사람이 위', () => {
  const { rows } = buildWordRanking(
    [
      result({ userId: 1, attemptsUsed: 2, durationMs: 5000, endedAt: 2000 }),
      result({ userId: 2, attemptsUsed: 2, durationMs: 5000, endedAt: 1000 }),
    ],
    'all'
  );
  assert.deepEqual(rows.map((r) => r.userId), [2, 1]);
});

test('단어별 통계: 실패·포기도 성공률 분모에 포함', () => {
  const { stats } = buildWordRanking(
    [
      result({ userId: 1, attemptsUsed: 2, durationMs: 20_000 }),
      result({ userId: 2, attemptsUsed: 4, durationMs: 40_000 }),
      result({ userId: 3, status: 'FAILED' }),
      result({ userId: 4, status: 'ABANDONED' }),
    ],
    'all'
  );

  assert.equal(stats.participants, 4);
  assert.equal(stats.successCount, 2);
  assert.equal(stats.successRate, 0.5);
  assert.equal(stats.avgAttempts, 3);
  assert.equal(stats.avgDurationMs, 30_000);
});

test('단어별 통계: 기록이 없으면 평균은 null (0이 아님)', () => {
  const { stats } = buildWordRanking([], 'all');
  assert.equal(stats.participants, 0);
  assert.equal(stats.successRate, null);
  assert.equal(stats.avgAttempts, null);
  assert.equal(stats.avgDurationMs, null);
});

test('한 사용자가 같은 단어 랭킹에 두 번 오르지 않는다', () => {
  const { rows } = buildWordRanking(
    [
      result({ userId: 1, attemptsUsed: 2, endedAt: 1000 }),
      result({ userId: 1, attemptsUsed: 1, endedAt: 2000 }),
    ],
    'all'
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].attemptsUsed, 2, '먼저 종료된 최초 도전 기록이 남는다');
});

test('기간 필터는 종료 시각 기준으로 자른다', () => {
  const now = Date.UTC(2026, 8, 16, 3, 0);
  const todayStart = periodStartTs('today', now);

  const { rows, stats } = buildWordRanking(
    [
      result({ userId: 1, endedAt: todayStart + 1000 }),
      result({ userId: 2, endedAt: todayStart - 1000 }),
    ],
    'today',
    now
  );

  assert.deepEqual(rows.map((r) => r.userId), [1]);
  assert.equal(stats.participants, 1);
});

/* ------------------------------------------------------------ 사전 */

test('사전의 모든 단어는 규칙의 자모 칸 수와 일치한다', async () => {
  const { allEntries, entryCount } = await import('../app/lib/wordgame/dictionary.ts');
  const { JAMO_COUNT } = await import('../app/lib/wordgame/config.ts');

  assert.ok(entryCount() > 0, '정답 후보가 하나도 없으면 게임을 시작할 수 없다');
  for (const entry of allEntries()) {
    assert.equal(entry.jamo.length, JAMO_COUNT, `${entry.word} 의 자모 수가 규칙과 다름`);
    assert.deepEqual(entry.jamo, decomposeJamo(entry.word));
  }
});

test('단어 ID 는 단어에서 결정적으로 생성된다', async () => {
  const { wordIdFor } = await import('../app/lib/wordgame/dictionary.ts');
  assert.equal(wordIdFor('사과'), wordIdFor('사과'));
  assert.notEqual(wordIdFor('사과'), wordIdFor('사람'));
});

test('자모 입력으로 사전 단어를 찾는다', async () => {
  const { findByJamo, allEntries } = await import('../app/lib/wordgame/dictionary.ts');
  const sample = allEntries()[0];

  assert.equal(findByJamo(sample.jamo)?.word, sample.word);
  assert.equal(findByJamo(['ㅎ', 'ㅎ', 'ㅎ', 'ㅎ', 'ㅎ']), undefined, '사전에 없는 입력');
});
