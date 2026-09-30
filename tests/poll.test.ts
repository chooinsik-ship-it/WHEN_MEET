/**
 * 약속 시간 투표 순수 로직 테스트
 * 실행: npm run test:poll
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  candidateKey,
  EARLIEST_START,
  formatSlot,
  isValidCandidate,
  LATEST_START,
  pickWinner,
  suggestCandidates,
  weekdayIndex,
  type Poll,
} from '../app/lib/poll.ts';

const empty = () => Array.from({ length: 7 }, () => Array(24).fill(false));

// 2026-09-30 은 수요일
const NOW = new Date(2026, 8, 30, 9, 0);

test('후보는 "날짜 + 시작 시각" 형식으로 표시된다', () => {
  assert.equal(formatSlot({ date: '2026-09-30', hour: 18 }), '9월 30일(수) 18:00');
  assert.equal(formatSlot({ date: '2026-09-30', hour: 18 }, 2), '9월 30일(수) 18:00~20:00');
});

test('요일 인덱스는 월요일 = 0', () => {
  assert.equal(weekdayIndex('2026-09-28'), 0); // 월
  assert.equal(weekdayIndex('2026-09-30'), 2); // 수
  assert.equal(weekdayIndex('2026-10-04'), 6); // 일
});

test('새벽·심야는 후보에서 제외된다', () => {
  const list = suggestCandidates({
    members: ['a', 'b'],
    schedules: [empty(), empty()],
    dateSchedules: [{}, {}],
    duration: 2,
    now: NOW,
    days: 14,
    limit: 14,
  });
  assert.ok(list.length > 0);
  for (const c of list) {
    assert.ok(c.hour >= EARLIEST_START && c.hour <= LATEST_START, `${c.hour}시는 범위 밖`);
  }
});

test('날짜마다 하나씩, 평일은 19시·주말은 14시를 우선한다', () => {
  const list = suggestCandidates({
    members: ['a', 'b'],
    schedules: [empty(), empty()],
    dateSchedules: [{}, {}],
    duration: 2,
    now: NOW,
    days: 7,
    limit: 7,
  });
  const dates = list.map(c => c.date);
  assert.equal(new Set(dates).size, dates.length, '같은 날짜가 두 번 나오면 안 된다');

  const sat = list.find(c => c.date === '2026-10-03');
  const thu = list.find(c => c.date === '2026-10-01');
  assert.equal(sat?.hour, 14);
  assert.equal(thu?.hour, 19);
});

test('오늘은 지금부터 3시간 이후만 후보가 된다', () => {
  const lateNow = new Date(2026, 8, 30, 20, 0);
  const list = suggestCandidates({
    members: ['a', 'b'],
    schedules: [empty(), empty()],
    dateSchedules: [{}, {}],
    duration: 1,
    now: lateNow,
    days: 1,
  });
  assert.equal(list.length, 0);
});

test('바쁜 시간과 바쁜 날짜를 피한다', () => {
  const a = empty();
  // a 는 목요일(인덱스 3) 18~21시 바쁨
  for (let h = 18; h < 22; h++) a[3][h] = true;
  const list = suggestCandidates({
    members: ['a', 'b'],
    schedules: [a, empty()],
    dateSchedules: [{}, { '2026-10-02': true }], // b 는 10/2 종일 바쁨
    duration: 2,
    now: NOW,
    days: 7,
    limit: 7,
  });
  const thu = list.find(c => c.date === '2026-10-01');
  assert.ok(thu, '목요일에도 다른 시간은 있다');
  assert.ok(thu!.hour + 2 <= 18 || thu!.hour >= 22, `목요일 ${thu!.hour}시는 a 가 바쁘다`);
  assert.equal(thu!.unavailable.length, 0);
  // 2인 그룹에서 한 명이 안 되면 과반이 아니므로 후보에서 빠진다
  assert.equal(list.find(c => c.date === '2026-10-02'), undefined);
});

test('전원 가능한 날을 먼저 고르고, 결과는 날짜순', () => {
  const busy = empty();
  // 3명 중 1명이 평일 저녁 내내 바쁨
  for (let d = 0; d < 5; d++) for (let h = 10; h < 24; h++) busy[d][h] = true;
  const list = suggestCandidates({
    members: ['a', 'b', 'c'],
    schedules: [busy, empty(), empty()],
    dateSchedules: [{}, {}, {}],
    duration: 2,
    now: NOW,
    days: 14,
    limit: 4,
  });
  assert.equal(list.length, 4);
  // 앞으로 2주의 주말 4일 (전원 가능)
  assert.deepEqual(list.map(c => c.date), ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11']);
  assert.ok(list.every(c => c.unavailable.length === 0));
});

test('후보 형식 검증', () => {
  assert.ok(isValidCandidate({ date: '2026-10-01', hour: 19 }));
  assert.ok(!isValidCandidate({ date: '2026-02-30', hour: 19 }));
  assert.ok(!isValidCandidate({ date: '2026-10-01', hour: 24 }));
  assert.ok(!isValidCandidate({ date: '10/01', hour: 19 }));
});

test('최다 득표 후보, 동률이면 이른 시간', () => {
  const poll: Pick<Poll, 'candidates'> = {
    candidates: [
      { date: '2026-10-03', hour: 14 },
      { date: '2026-10-01', hour: 19 },
    ],
  };
  const k1 = candidateKey(poll.candidates[0]);
  const k2 = candidateKey(poll.candidates[1]);
  assert.deepEqual(pickWinner(poll, { a: [k1, k2], b: [k1, k2] }), { date: '2026-10-01', hour: 19 });
  assert.deepEqual(pickWinner(poll, { a: [k1], b: [k1, k2] }), { date: '2026-10-03', hour: 14 });
  assert.equal(pickWinner(poll, { a: [], b: [] }), null);
});
