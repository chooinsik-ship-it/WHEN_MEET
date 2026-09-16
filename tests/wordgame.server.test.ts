/**
 * 게임 진행·집계 서버 로직 테스트 (인메모리 KV 사용)
 * 실행: npm run test:wordgame:server
 *
 * @vercel/kv 를 모듈 모킹으로 가로채므로 실제 Redis 없이 돌아간다.
 */
import test, { before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeKv } from './fake-kv.mjs';

const fakeKv = createFakeKv();

// store.ts 가 동적 import 하기 전에 모킹해야 한다
mock.module('@vercel/kv', { exports: { kv: fakeKv } });

process.env.KV_REST_API_URL = 'https://fake.upstash.io';
process.env.KV_REST_API_TOKEN = 'fake-token';

type ServiceModule = typeof import('../app/lib/wordgame/service.ts');
type StoreModule = typeof import('../app/lib/wordgame/store.ts');
type DictModule = typeof import('../app/lib/wordgame/dictionary.ts');

let service: ServiceModule;
let store: StoreModule;
let dict: DictModule;

before(async () => {
  service = await import('../app/lib/wordgame/service.ts');
  store = await import('../app/lib/wordgame/store.ts');
  dict = await import('../app/lib/wordgame/dictionary.ts');
});

/** 정답을 알고 있는 상태에서 한 번에 맞히기 */
async function solveGame(userId: number, gameId: string) {
  const game = await store.getGame(gameId);
  assert.ok(game);
  return service.submitGuess(userId, gameId, game!.answerJamo);
}

test('게임 시작: 최초 도전으로 표시되고 정답은 공개되지 않는다', async () => {
  const userId = 1001;
  const game = await service.startGame(userId);

  assert.equal(game.status, 'PLAYING');
  assert.equal(game.isFirstAttempt, true);
  assert.equal(game.countsForWordRanking, true);

  const publicView = service.toPublicGame(game);
  assert.equal(publicView.answer, undefined);
  assert.equal(publicView.wordId, undefined);
});

test('성공하면 정답이 공개되고 소요 시간이 기록된다', async () => {
  const userId = 1002;
  const game = await service.startGame(userId);
  const outcome = await solveGame(userId, game.gameId);

  assert.equal(outcome.solved, true);
  assert.equal(outcome.game.status, 'SUCCESS');
  assert.equal(outcome.game.attemptsUsed, 1);
  assert.ok(outcome.game.answer);
  assert.ok(typeof outcome.game.durationMs === 'number' && outcome.game.durationMs! >= 0);
});

test('잘못된 입력은 시도 횟수를 소모하지 않는다', async () => {
  const userId = 1003;
  const game = await service.startGame(userId);

  await assert.rejects(
    () => service.submitGuess(userId, game.gameId, ['ㄱ', 'ㅏ']),
    (e: Error & { code?: string }) => e.code === 'INVALID_LENGTH'
  );
  await assert.rejects(
    () => service.submitGuess(userId, game.gameId, ['ㅎ', 'ㅎ', 'ㅎ', 'ㅎ', 'ㅎ']),
    (e: Error & { code?: string }) => e.code === 'NOT_IN_DICTIONARY'
  );

  const after = await store.getGame(game.gameId);
  assert.equal(after!.attemptsUsed, 0);
  assert.equal(after!.status, 'PLAYING');
});

test('최대 시도를 모두 쓰면 FAILED 로 종료된다', async () => {
  const userId = 1004;
  const game = await service.startGame(userId);
  const wrong = dict.allEntries().filter((e) => e.wordId !== game.wordId);

  let last;
  for (let i = 0; i < game.maxAttempts; i++) {
    last = await service.submitGuess(userId, game.gameId, wrong[i].jamo);
  }

  assert.equal(last!.game.status, 'FAILED');
  assert.equal(last!.game.attemptsUsed, game.maxAttempts);
  assert.equal(last!.game.answer, game.answer, '실패하면 정답을 공개한다');
});

test('종료된 게임에는 추가 제출·포기를 할 수 없다', async () => {
  const userId = 1005;
  const game = await service.startGame(userId);
  await solveGame(userId, game.gameId);

  await assert.rejects(
    () => service.submitGuess(userId, game.gameId, dict.allEntries()[0].jamo),
    (e: Error & { code?: string }) => e.code === 'ALREADY_FINISHED'
  );
  await assert.rejects(
    () => service.abandonGame(userId, game.gameId),
    (e: Error & { code?: string }) => e.code === 'ALREADY_FINISHED'
  );
});

test('다른 사용자의 게임에는 접근할 수 없다', async () => {
  const owner = 1006;
  const stranger = 1007;
  const game = await service.startGame(owner);

  await assert.rejects(
    () => service.loadOwnGame(stranger, game.gameId),
    (e: Error & { code?: string }) => e.code === 'NOT_FOUND'
  );
});

test('새 게임을 시작하면 진행 중이던 게임은 포기 처리된다', async () => {
  const userId = 1008;
  const first = await service.startGame(userId);
  const second = await service.startGame(userId);

  const old = await store.getGame(first.gameId);
  assert.equal(old!.status, 'ABANDONED');
  assert.notEqual(second.gameId, first.gameId);

  const current = await service.getCurrentGame(userId);
  assert.equal(current!.gameId, second.gameId, '진행 중 게임은 항상 1개');
});

test('진행 중 게임은 새로고침해도 이어진다', async () => {
  const userId = 1009;
  const game = await service.startGame(userId);
  await service.submitGuess(userId, game.gameId, dict.allEntries().find((e) => e.wordId !== game.wordId)!.jamo);

  const resumed = await service.getCurrentGame(userId);
  assert.equal(resumed!.gameId, game.gameId);
  assert.equal(resumed!.attemptsUsed, 1);
  assert.equal(resumed!.guesses.length, 1);
});

test('오래된 게임은 포기로 만료된다', async () => {
  const userId = 1010;
  const { GAME_EXPIRY_MS } = await import('../app/lib/wordgame/config.ts');
  const game = await service.startGame(userId);

  // 시작 시각을 만료 기준보다 과거로 돌린다
  const stored = await store.getGame(game.gameId);
  stored!.startedAt = Date.now() - GAME_EXPIRY_MS - 1000;
  await store.saveGame(stored!);

  const current = await service.getCurrentGame(userId);
  assert.equal(current, null);

  const expired = await store.getGame(game.gameId);
  assert.equal(expired!.status, 'ABANDONED');
});

test('재도전은 단어별 랭킹에 반영되지 않는다 (개인 통계에는 반영)', async () => {
  const userId = 1011;

  // 1회차: 최초 도전 성공
  const first = await service.startGame(userId);
  const wordId = first.wordId;
  await solveGame(userId, first.gameId);

  // 2회차: 같은 단어를 다시 출제 (최초 도전 점유가 이미 있으므로 재도전)
  const retryGame = await service.startGame(userId);
  const stored = await store.getGame(retryGame.gameId);
  const entry = dict.getEntryById(wordId)!;
  Object.assign(stored!, {
    wordId,
    answer: entry.word,
    answerJamo: entry.jamo,
    isFirstAttempt: await store.claimFirstAttempt(userId, wordId, retryGame.gameId),
  });
  stored!.countsForWordRanking = stored!.isFirstAttempt;
  await store.saveGame(stored!);

  assert.equal(stored!.isFirstAttempt, false, '이미 최초 도전을 점유했으므로 재도전');

  await solveGame(userId, retryGame.gameId);

  const results = await store.getWordResults(wordId);
  const mine = results.filter((r) => r.userId === userId);
  assert.equal(mine.length, 1, '단어별 랭킹에는 최초 도전 1건만 남는다');
  assert.equal(mine[0].gameId, first.gameId);

  const agg = await store.getAgg('all', userId);
  assert.equal(agg.success, 2, '재도전 성공도 개인 통계에는 집계된다');
});

test('최초 도전 실패 후 재도전에 성공해도 단어별 랭킹에 오르지 못한다', async () => {
  const userId = 1012;

  const first = await service.startGame(userId);
  const wordId = first.wordId;
  const wrong = dict.allEntries().filter((e) => e.wordId !== wordId);
  for (let i = 0; i < first.maxAttempts; i++) {
    await service.submitGuess(userId, first.gameId, wrong[i].jamo);
  }

  const failed = await store.getGame(first.gameId);
  assert.equal(failed!.status, 'FAILED');

  // 재도전 (같은 단어)
  const retry = await service.startGame(userId);
  const stored = await store.getGame(retry.gameId);
  const entry = dict.getEntryById(wordId)!;
  Object.assign(stored!, { wordId, answer: entry.word, answerJamo: entry.jamo });
  stored!.isFirstAttempt = await store.claimFirstAttempt(userId, wordId, retry.gameId);
  stored!.countsForWordRanking = stored!.isFirstAttempt;
  await store.saveGame(stored!);
  await solveGame(userId, retry.gameId);

  const { buildWordRanking } = await import('../app/lib/wordgame/rankings.ts');
  const { rows } = buildWordRanking(await store.getWordResults(wordId), 'all');
  assert.equal(rows.some((r) => r.userId === userId), false, '실패한 최초 도전은 순위에 오르지 않는다');
});

test('동시 게임 시작에도 최초 도전이 중복 점유되지 않는다', async () => {
  const userId = 1013;
  const results = await Promise.allSettled([
    service.startGame(userId),
    service.startGame(userId),
    service.startGame(userId),
  ]);

  const started = results.filter((r) => r.status === 'fulfilled');
  assert.ok(started.length >= 1);

  // 점유된 최초 도전은 게임당 최대 1건
  const wordIds = started.map((r) => (r as PromiseFulfilledResult<{ wordId: string }>).value.wordId);
  for (const wordId of new Set(wordIds)) {
    const claimed = await store.getFirstAttemptGameId(userId, wordId);
    assert.ok(claimed, '최초 도전 점유 기록이 있어야 한다');
  }
});

test('집계: 성공·실패·포기가 종료 게임 수와 연속 성공에 반영된다', async () => {
  const userId = 1014;

  // 성공 2회
  for (let i = 0; i < 2; i++) {
    const g = await service.startGame(userId);
    await solveGame(userId, g.gameId);
  }
  let agg = await store.getAgg('all', userId);
  assert.equal(agg.success, 2);
  assert.equal(agg.curStreak, 2);
  assert.equal(agg.maxStreak, 2);

  // 포기 1회 → 연속 성공 끊김
  const abandonTarget = await service.startGame(userId);
  await service.abandonGame(userId, abandonTarget.gameId);

  agg = await store.getAgg('all', userId);
  assert.equal(agg.abandoned, 1);
  assert.equal(agg.curStreak, 0, '포기는 연속 성공을 끊는다');
  assert.equal(agg.maxStreak, 2, '최고 연속 기록은 유지된다');
  assert.equal(agg.finished, agg.success + agg.failed + agg.abandoned);
  assert.equal(agg.started, 3);
});

test('집계는 게임당 한 번만 반영된다 (중복 저장 방지)', async () => {
  const userId = 1015;
  const game = await service.startGame(userId);
  await solveGame(userId, game.gameId);

  const before = await store.getAgg('all', userId);
  const history = await store.getHistory(userId, 0, 100);

  // 이미 종료된 게임을 다시 종료 처리해도 집계가 늘어나면 안 된다
  await assert.rejects(() => service.abandonGame(userId, game.gameId));

  const after = await store.getAgg('all', userId);
  const historyAfter = await store.getHistory(userId, 0, 100);

  assert.deepEqual(after, before);
  assert.equal(historyAfter.length, history.length);
});

test('단어 선정: 아직 출제되지 않은 단어를 우선한다', async () => {
  const userId = 1016;
  const seen = new Set<string>();

  for (let i = 0; i < 8; i++) {
    const game = await service.startGame(userId);
    assert.equal(seen.has(game.wordId), false, '미출제 단어가 남아 있으면 중복 출제하지 않는다');
    seen.add(game.wordId);
    await service.abandonGame(userId, game.gameId);
  }
});
