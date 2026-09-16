/**
 * 게임 데이터 저장소 (Upstash Redis / @vercel/kv)
 *
 * 이 프로젝트에는 RDB가 없어 요구사항의 "테이블·마이그레이션·인덱스"를
 * Redis 키 설계로 대체한다. 대응 관계는 README_WORDGAME.md 참고.
 *
 * 키 구조 (모두 ruleId로 분리 → 규칙이 다른 기록은 절대 섞이지 않는다)
 *   wg:game:<gameId>                        게임 1건
 *   wg:active:<ruleId>:<userId>             진행 중 게임 ID (사용자당 1개)
 *   wg:first:<ruleId>:<userId>:<wordId>     최초 도전 점유 (SET NX = 유니크 제약)
 *   wg:played:<ruleId>:<userId>             이미 출제된 단어 집합
 *   wg:recent:<ruleId>:<userId>             직전 출제 단어 (반복 방지)
 *   wg:hist:<ruleId>:<userId>               개인 플레이 기록 (최신순 리스트)
 *   wg:uwords:<ruleId>:<userId>             최초 도전이 끝난 단어 목록
 *   wg:wordres:<ruleId>:<wordId>            단어별 최초 도전 결과 리스트
 *   wg:agg:<ruleId>:<bucket>:<userId>       기간별 집계
 *   wg:aggidx:<ruleId>:<bucket>             해당 버킷에 기록이 있는 사용자 인덱스
 *   wg:idem:<gameId>:<requestId>            제출 멱등성
 *   wg:lock:<name>                          동시성 제어
 *   wg:rate:<userId>:<action>:<window>      요청 제한
 */
import { RULE_ID, HISTORY_LIMIT, RECENT_WORD_MEMORY } from './config';
import { bucketsFor } from './time';
import { allEntries, type DictionaryEntry } from './dictionary';
import {
  emptyAgg,
  type GameRecord,
  type HistoryEntry,
  type UserAgg,
  type UserWordEntry,
  type WordResultEntry,
} from './types';

export const isKvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

type KvClient = typeof import('@vercel/kv')['kv'];

let kvPromise: Promise<KvClient> | null = null;
export async function kvClient(): Promise<KvClient> {
  if (!kvPromise) kvPromise = import('@vercel/kv').then((m) => m.kv);
  return kvPromise;
}

/* ------------------------------------------------------------------ 키 */

const gameKey = (gameId: string) => `wg:game:${gameId}`;
const activeKey = (userId: number) => `wg:active:${RULE_ID}:${userId}`;
const firstKey = (userId: number, wordId: string) => `wg:first:${RULE_ID}:${userId}:${wordId}`;
const playedKey = (userId: number) => `wg:played:${RULE_ID}:${userId}`;
const recentKey = (userId: number) => `wg:recent:${RULE_ID}:${userId}`;
const historyKey = (userId: number) => `wg:hist:${RULE_ID}:${userId}`;
const userWordsKey = (userId: number) => `wg:uwords:${RULE_ID}:${userId}`;
const wordResultsKey = (wordId: string) => `wg:wordres:${RULE_ID}:${wordId}`;
const aggKey = (bucket: string, userId: number) => `wg:agg:${RULE_ID}:${bucket}:${userId}`;
const aggIndexKey = (bucket: string) => `wg:aggidx:${RULE_ID}:${bucket}`;
const idemKey = (gameId: string, requestId: string) => `wg:idem:${gameId}:${requestId}`;

/* -------------------------------------------------------------- 동시성 */

/** 짧은 분산 락. 획득 실패 시 null 반환(호출 측에서 409 처리) */
export async function acquireLock(name: string, ttlSec = 10): Promise<(() => Promise<void>) | null> {
  const kv = await kvClient();
  const key = `wg:lock:${name}`;
  const ok = await kv.set(key, '1', { nx: true, ex: ttlSec });
  if (!ok) return null;
  return async () => {
    await kv.del(key);
  };
}

/* ------------------------------------------------------------ 요청 제한 */

export async function checkRateLimit(
  userId: number,
  action: string,
  windowSec: number,
  max: number
): Promise<boolean> {
  const kv = await kvClient();
  const window = Math.floor(Date.now() / (windowSec * 1000));
  const key = `wg:rate:${userId}:${action}:${window}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, windowSec + 1);
  return count <= max;
}

/* ---------------------------------------------------------------- 게임 */

export async function getGame(gameId: string): Promise<GameRecord | null> {
  const kv = await kvClient();
  return (await kv.get<GameRecord>(gameKey(gameId))) ?? null;
}

export async function saveGame(game: GameRecord): Promise<void> {
  const kv = await kvClient();
  await kv.set(gameKey(game.gameId), game);
}

export async function getActiveGameId(userId: number): Promise<string | null> {
  const kv = await kvClient();
  return (await kv.get<string>(activeKey(userId))) ?? null;
}

export async function setActiveGame(userId: number, gameId: string): Promise<void> {
  const kv = await kvClient();
  await kv.set(activeKey(userId), gameId);
}

export async function clearActiveGame(userId: number, gameId: string): Promise<void> {
  const kv = await kvClient();
  const current = await kv.get<string>(activeKey(userId));
  if (current === gameId) await kv.del(activeKey(userId));
}

/* ------------------------------------------------------- 최초 도전 점유 */

/**
 * 최초 도전 점유. SET NX 이므로 동시에 두 게임이 시작돼도
 * 한쪽만 최초 도전이 된다(유니크 제약 역할).
 */
export async function claimFirstAttempt(
  userId: number,
  wordId: string,
  gameId: string
): Promise<boolean> {
  const kv = await kvClient();
  const ok = await kv.set(firstKey(userId, wordId), gameId, { nx: true });
  return Boolean(ok);
}

export async function getFirstAttemptGameId(userId: number, wordId: string): Promise<string | null> {
  const kv = await kvClient();
  return (await kv.get<string>(firstKey(userId, wordId))) ?? null;
}

/** 최초 도전 점유 해제 (게임 생성이 실패했을 때 되돌리기) */
export async function releaseFirstAttempt(userId: number, wordId: string, gameId: string): Promise<void> {
  const kv = await kvClient();
  const current = await kv.get<string>(firstKey(userId, wordId));
  if (current === gameId) await kv.del(firstKey(userId, wordId));
}

/* ------------------------------------------------------------ 단어 선정 */

/**
 * 출제 단어 선정
 * 1) 아직 출제된 적 없는 단어 우선
 * 2) 모두 소진되면 최근 출제분만 제외하고 반복 출제 허용
 * 3) 후보가 비는 경우에도 절대 실패하지 않는다 (무한 루프 없음)
 */
export async function pickWord(userId: number): Promise<DictionaryEntry> {
  const kv = await kvClient();
  const entries = allEntries();
  if (entries.length === 0) {
    throw new Error('사전에 현재 규칙에 맞는 단어가 없습니다.');
  }

  const [playedRaw, recentRaw] = await Promise.all([
    kv.smembers(playedKey(userId)).catch(() => [] as string[]),
    kv.lrange<string>(recentKey(userId), 0, RECENT_WORD_MEMORY - 1).catch(() => [] as string[]),
  ]);

  const played = new Set((playedRaw ?? []).map(String));
  const recent = new Set((recentRaw ?? []).map(String));

  const unplayed = entries.filter((e) => !played.has(e.wordId) && !recent.has(e.wordId));
  if (unplayed.length > 0) {
    return unplayed[Math.floor(Math.random() * unplayed.length)];
  }

  const notRecent = entries.filter((e) => !recent.has(e.wordId));
  const pool = notRecent.length > 0 ? notRecent : entries;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function markWordIssued(userId: number, wordId: string): Promise<void> {
  const kv = await kvClient();
  await Promise.all([
    kv.sadd(playedKey(userId), wordId),
    kv.lpush(recentKey(userId), wordId).then(() => kv.ltrim(recentKey(userId), 0, RECENT_WORD_MEMORY - 1)),
  ]);
}

/* ---------------------------------------------------------------- 집계 */

export async function getAgg(bucket: string, userId: number): Promise<UserAgg> {
  const kv = await kvClient();
  return (await kv.get<UserAgg>(aggKey(bucket, userId))) ?? emptyAgg();
}

async function updateAgg(
  bucket: string,
  userId: number,
  mutate: (agg: UserAgg) => void
): Promise<void> {
  const kv = await kvClient();
  const agg = (await kv.get<UserAgg>(aggKey(bucket, userId))) ?? emptyAgg();
  mutate(agg);
  await Promise.all([
    kv.set(aggKey(bucket, userId), agg),
    kv.sadd(aggIndexKey(bucket), String(userId)),
  ]);
}

/** 게임 시작 집계 (시작 시각 기준 버킷) */
export async function recordStart(userId: number, startedAt: number): Promise<void> {
  await Promise.all(
    bucketsFor(startedAt).map((bucket) =>
      updateAgg(bucket, userId, (agg) => {
        agg.started += 1;
        if (agg.firstRecordedAt === null) agg.firstRecordedAt = startedAt;
      })
    )
  );
}

/** 게임 종료 집계 (종료 시각 기준 버킷) */
export async function recordFinish(game: GameRecord): Promise<void> {
  const endedAt = game.endedAt ?? Date.now();
  const durationMs = game.durationMs ?? 0;
  const success = game.status === 'SUCCESS';

  await Promise.all(
    bucketsFor(endedAt).map((bucket) =>
      updateAgg(bucket, game.userId, (agg) => {
        agg.finished += 1;
        if (agg.firstRecordedAt === null) agg.firstRecordedAt = endedAt;
        agg.lastEndedAt = endedAt;

        if (success) {
          agg.success += 1;
          agg.attemptsSum += game.attemptsUsed;
          agg.durationSum += durationMs;
          agg.dist[String(game.attemptsUsed)] = (agg.dist[String(game.attemptsUsed)] ?? 0) + 1;

          if (agg.bestAttempts === null || game.attemptsUsed < agg.bestAttempts) {
            agg.bestAttempts = game.attemptsUsed;
            agg.bestAttemptsCount = 1;
          } else if (game.attemptsUsed === agg.bestAttempts) {
            agg.bestAttemptsCount += 1;
          }

          if (agg.bestDurationMs === null || durationMs < agg.bestDurationMs) {
            agg.bestDurationMs = durationMs;
          }

          agg.curStreak += 1;
          if (agg.curStreak > agg.maxStreak) agg.maxStreak = agg.curStreak;
        } else {
          if (game.status === 'FAILED') agg.failed += 1;
          else agg.abandoned += 1;
          // 실패·포기는 연속 성공을 끊는다
          agg.curStreak = 0;
        }
      })
    )
  );
}

export async function listAggUserIds(bucket: string): Promise<number[]> {
  const kv = await kvClient();
  const raw = await kv.smembers(aggIndexKey(bucket)).catch(() => [] as string[]);
  return (raw ?? []).map((v) => Number(v)).filter((v) => Number.isFinite(v));
}

export async function getAggMany(bucket: string, userIds: number[]): Promise<Map<number, UserAgg>> {
  const result = new Map<number, UserAgg>();
  if (userIds.length === 0) return result;

  const kv = await kvClient();
  const keys = userIds.map((id) => aggKey(bucket, id));
  const values = await kv.mget<(UserAgg | null)[]>(...keys);

  userIds.forEach((id, i) => {
    const agg = values?.[i];
    if (agg) result.set(id, agg);
  });
  return result;
}

/* ------------------------------------------------------- 기록 / 단어별 */

export async function appendHistory(userId: number, entry: HistoryEntry): Promise<void> {
  const kv = await kvClient();
  await kv.lpush(historyKey(userId), JSON.stringify(entry));
  await kv.ltrim(historyKey(userId), 0, HISTORY_LIMIT - 1);
}

export async function getHistory(userId: number, offset: number, limit: number): Promise<HistoryEntry[]> {
  const kv = await kvClient();
  const raw = await kv.lrange<HistoryEntry | string>(historyKey(userId), offset, offset + limit - 1);
  return (raw ?? []).map(parseEntry<HistoryEntry>).filter(Boolean) as HistoryEntry[];
}

export async function historyLength(userId: number): Promise<number> {
  const kv = await kvClient();
  return (await kv.llen(historyKey(userId))) ?? 0;
}

export async function appendUserWord(userId: number, entry: UserWordEntry): Promise<void> {
  const kv = await kvClient();
  await kv.lpush(userWordsKey(userId), JSON.stringify(entry));
}

export async function getUserWords(userId: number): Promise<UserWordEntry[]> {
  const kv = await kvClient();
  const raw = await kv.lrange<UserWordEntry | string>(userWordsKey(userId), 0, -1);
  return (raw ?? []).map(parseEntry<UserWordEntry>).filter(Boolean) as UserWordEntry[];
}

export async function appendWordResult(wordId: string, entry: WordResultEntry): Promise<void> {
  const kv = await kvClient();
  await kv.lpush(wordResultsKey(wordId), JSON.stringify(entry));
}

export async function getWordResults(wordId: string): Promise<WordResultEntry[]> {
  const kv = await kvClient();
  const raw = await kv.lrange<WordResultEntry | string>(wordResultsKey(wordId), 0, -1);
  return (raw ?? []).map(parseEntry<WordResultEntry>).filter(Boolean) as WordResultEntry[];
}

/** Upstash 는 JSON 을 자동 파싱하기도 하고 문자열로 돌려주기도 한다 */
function parseEntry<T>(value: T | string): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ 멱등 제출 */

export async function getIdempotentResult<T>(gameId: string, requestId: string): Promise<T | null> {
  const kv = await kvClient();
  const value = await kv.get<T | string>(idemKey(gameId, requestId));
  return value === null || value === undefined ? null : parseEntry<T>(value);
}

export async function saveIdempotentResult(gameId: string, requestId: string, result: unknown): Promise<void> {
  const kv = await kvClient();
  await kv.set(idemKey(gameId, requestId), JSON.stringify(result), { ex: 60 * 60 });
}

/* ------------------------------------------------------------ 닉네임 조회 */

export interface PublicProfile {
  userId: number;
  nickname: string;
  avatar?: string;
}

/** 기존 사용자 레코드(user:<id>)에서 표시 정보를 가져온다 */
export async function getProfiles(userIds: number[]): Promise<Map<number, PublicProfile>> {
  const map = new Map<number, PublicProfile>();
  if (userIds.length === 0) return map;

  const kv = await kvClient();
  const values = await kv.mget<(Record<string, unknown> | null)[]>(
    ...userIds.map((id) => `user:${id}`)
  );

  userIds.forEach((id, i) => {
    const user = values?.[i];
    map.set(id, {
      userId: id,
      nickname: (user?.nickname as string) || '알 수 없음',
      avatar: (user?.avatar as string) || undefined,
    });
  });
  return map;
}
