/**
 * 게임 진행 로직 (서버 전용)
 *
 * 정답 선정·사전 검증·자모 판정·성공 여부·시도 횟수·소요 시간은 모두 여기서 처리한다.
 * 클라이언트가 보낸 값은 "입력 자모"와 "요청 식별자"뿐이다.
 */
import { randomUUID } from 'crypto';
import { decomposeJamo, isBasicJamo, judgeGuess } from '../hangul';
import { GAME_EXPIRY_MS, JAMO_COUNT, MAX_ATTEMPTS, RULE_ID, RULE_VERSION } from './config';
import { findByJamo, getEntryById } from './dictionary';
import {
  appendHistory,
  appendUserWord,
  appendWordResult,
  acquireLock,
  claimFirstAttempt,
  clearActiveGame,
  getActiveGameId,
  getGame,
  markWordIssued,
  pickWord,
  recordFinish,
  recordStart,
  releaseFirstAttempt,
  saveGame,
  setActiveGame,
} from './store';
import type { GameRecord, GameStatus, PublicGame } from './types';

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** 진행 중인 게임에서는 정답을 절대 포함하지 않는다. */
export function toPublicGame(game: GameRecord): PublicGame {
  const finished = game.status !== 'PLAYING';
  return {
    gameId: game.gameId,
    ruleId: game.ruleId,
    ruleVersion: game.ruleVersion,
    jamoCount: game.jamoCount,
    maxAttempts: game.maxAttempts,
    status: game.status,
    attemptsUsed: game.attemptsUsed,
    guesses: game.guesses.map((g) => ({ jamo: g.jamo, marks: g.marks, word: g.word })),
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    durationMs: game.durationMs,
    isFirstAttempt: game.isFirstAttempt,
    countsForWordRanking: game.countsForWordRanking,
    ...(finished
      ? { answer: game.answer, answerJamo: game.answerJamo, wordId: game.wordId }
      : {}),
  };
}

/** 종료 처리 — 집계는 단 한 번만 반영된다. */
async function finalize(game: GameRecord, status: Exclude<GameStatus, 'PLAYING'>, now: number) {
  game.status = status;
  game.endedAt = now;
  game.durationMs = now - game.startedAt;

  if (game.aggregated) {
    await saveGame(game);
    await clearActiveGame(game.userId, game.gameId);
    return game;
  }

  // 중복 집계 방지: 먼저 플래그를 세운 상태로 저장한 뒤 집계한다
  game.aggregated = true;
  await saveGame(game);

  const entry = getEntryById(game.wordId);

  await recordFinish(game);
  await appendHistory(game.userId, {
    gameId: game.gameId,
    wordId: game.wordId,
    word: game.answer,
    status,
    attemptsUsed: game.attemptsUsed,
    durationMs: game.durationMs,
    endedAt: now,
    isFirstAttempt: game.isFirstAttempt,
  });

  if (game.countsForWordRanking) {
    await appendWordResult(game.wordId, {
      userId: game.userId,
      status,
      attemptsUsed: game.attemptsUsed,
      durationMs: game.durationMs,
      endedAt: now,
      gameId: game.gameId,
    });
    await appendUserWord(game.userId, {
      wordId: game.wordId,
      word: entry?.word ?? game.answer,
      status,
      attemptsUsed: game.attemptsUsed,
      durationMs: game.durationMs,
      endedAt: now,
    });
  }

  await clearActiveGame(game.userId, game.gameId);
  return game;
}

/**
 * 본인 게임 조회 + 만료 처리
 * 다른 사용자의 gameId 는 존재 자체를 알리지 않기 위해 404로 응답한다.
 */
export async function loadOwnGame(userId: number, gameId: string): Promise<GameRecord> {
  const game = await getGame(gameId);
  if (!game || game.userId !== userId) {
    throw new GameError('NOT_FOUND', '게임을 찾을 수 없습니다.', 404);
  }

  if (game.status === 'PLAYING' && Date.now() - game.startedAt > GAME_EXPIRY_MS) {
    await finalize(game, 'ABANDONED', game.startedAt + GAME_EXPIRY_MS);
  }
  return game;
}

/** 진행 중인 게임 (없으면 null) */
export async function getCurrentGame(userId: number): Promise<GameRecord | null> {
  const activeId = await getActiveGameId(userId);
  if (!activeId) return null;

  const game = await getGame(activeId);
  if (!game || game.userId !== userId) return null;

  if (game.status !== 'PLAYING') {
    await clearActiveGame(userId, game.gameId);
    return null;
  }

  if (Date.now() - game.startedAt > GAME_EXPIRY_MS) {
    await finalize(game, 'ABANDONED', game.startedAt + GAME_EXPIRY_MS);
    return null;
  }

  return game;
}

/**
 * 새 게임 시작
 * - 진행 중 게임이 있으면 포기 처리 후 새로 만든다
 * - 최초 도전 여부는 여기서 서버가 확정한다 (SET NX)
 */
export async function startGame(userId: number): Promise<GameRecord> {
  const release = await acquireLock(`start:${userId}`, 10);
  if (!release) {
    throw new GameError('BUSY', '이미 게임을 시작하는 중입니다. 잠시 후 다시 시도해주세요.', 409);
  }

  try {
    const existing = await getCurrentGame(userId);
    if (existing) {
      await finalize(existing, 'ABANDONED', Date.now());
    }

    const entry = await pickWord(userId);
    const now = Date.now();
    const gameId = randomUUID();

    const isFirstAttempt = await claimFirstAttempt(userId, entry.wordId, gameId);

    const game: GameRecord = {
      gameId,
      userId,
      wordId: entry.wordId,
      answer: entry.word,
      answerJamo: entry.jamo,
      ruleId: RULE_ID,
      ruleVersion: RULE_VERSION,
      jamoCount: JAMO_COUNT,
      maxAttempts: MAX_ATTEMPTS,
      status: 'PLAYING',
      attemptsUsed: 0,
      guesses: [],
      startedAt: now,
      endedAt: null,
      durationMs: null,
      isFirstAttempt,
      countsForWordRanking: isFirstAttempt,
      aggregated: false,
    };

    try {
      await saveGame(game);
      await setActiveGame(userId, gameId);
      await markWordIssued(userId, entry.wordId);
      await recordStart(userId, now);
    } catch (error) {
      // 게임 생성이 끝까지 못 가면 최초 도전 점유를 되돌린다
      if (isFirstAttempt) await releaseFirstAttempt(userId, entry.wordId, gameId);
      throw error;
    }

    return game;
  } finally {
    await release();
  }
}

export interface GuessOutcome {
  game: PublicGame;
  marks: ReturnType<typeof judgeGuess>;
  solved: boolean;
}

/** 입력 제출 */
export async function submitGuess(
  userId: number,
  gameId: string,
  rawJamo: unknown
): Promise<GuessOutcome> {
  const jamo = normalizeJamoInput(rawJamo);

  const release = await acquireLock(`game:${gameId}`, 10);
  if (!release) {
    throw new GameError('BUSY', '직전 제출을 처리하는 중입니다.', 409);
  }

  try {
    const game = await loadOwnGame(userId, gameId);

    if (game.status !== 'PLAYING') {
      throw new GameError('ALREADY_FINISHED', '이미 종료된 게임입니다.', 409);
    }

    // --- 유효성 검사: 아래 오류들은 시도 횟수를 소모하지 않는다 ---
    if (jamo.length !== game.jamoCount) {
      throw new GameError('INVALID_LENGTH', `자모 ${game.jamoCount}칸을 채워주세요.`, 422);
    }
    if (!jamo.every(isBasicJamo)) {
      throw new GameError('INVALID_JAMO', '기본 자음·모음만 입력할 수 있습니다.', 422);
    }

    const dictEntry = findByJamo(jamo);
    if (!dictEntry) {
      throw new GameError('NOT_IN_DICTIONARY', '사전에 없는 단어입니다.', 422);
    }

    // --- 판정 ---
    const marks = judgeGuess(jamo, game.answerJamo);
    const solved = marks.every((m) => m === 'correct');
    const now = Date.now();

    game.attemptsUsed += 1;
    game.guesses.push({ jamo, word: dictEntry.word, marks, at: now });

    if (solved) {
      await finalize(game, 'SUCCESS', now);
    } else if (game.attemptsUsed >= game.maxAttempts) {
      await finalize(game, 'FAILED', now);
    } else {
      await saveGame(game);
    }

    return { game: toPublicGame(game), marks, solved };
  } finally {
    await release();
  }
}

/** 포기 */
export async function abandonGame(userId: number, gameId: string): Promise<PublicGame> {
  const release = await acquireLock(`game:${gameId}`, 10);
  if (!release) {
    throw new GameError('BUSY', '처리 중입니다. 잠시 후 다시 시도해주세요.', 409);
  }

  try {
    const game = await loadOwnGame(userId, gameId);
    if (game.status !== 'PLAYING') {
      throw new GameError('ALREADY_FINISHED', '이미 종료된 게임입니다.', 409);
    }
    await finalize(game, 'ABANDONED', Date.now());
    return toPublicGame(game);
  } finally {
    await release();
  }
}

/** 입력값 정규화: 자모 배열 또는 문자열(단어/자모 나열) 모두 허용 */
function normalizeJamoInput(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v)).flatMap((v) => decomposeJamo(v));
  }
  if (typeof raw === 'string') {
    return decomposeJamo(raw);
  }
  throw new GameError('INVALID_INPUT', '입력 형식이 올바르지 않습니다.', 422);
}
