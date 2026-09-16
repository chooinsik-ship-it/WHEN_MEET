/** 게임 API 클라이언트 (쿠키 세션 사용) */

export interface RuleSummary {
  ruleId: string;
  ruleVersion: number;
  jamoCount: number;
  maxAttempts: number;
}

export type Mark = 'correct' | 'present' | 'absent';
export type GameStatus = 'PLAYING' | 'SUCCESS' | 'FAILED' | 'ABANDONED';

export interface PublicGame {
  gameId: string;
  ruleId: string;
  ruleVersion: number;
  jamoCount: number;
  maxAttempts: number;
  status: GameStatus;
  attemptsUsed: number;
  guesses: { jamo: string[]; marks: Mark[]; word?: string }[];
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  isFirstAttempt: boolean;
  countsForWordRanking: boolean;
  answer?: string;
  answerJamo?: string[];
  wordId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? '요청에 실패했습니다.',
      (data as { code?: string }).code ?? 'UNKNOWN',
      response.status
    );
  }
  return data as T;
}

export const gameApi = {
  current: () => request<{ game: PublicGame | null; rule: RuleSummary }>('/api/word-games/me/current'),

  start: () =>
    request<{ game: PublicGame; rule: RuleSummary }>('/api/word-games/start', { method: 'POST' }),

  guess: (gameId: string, jamo: string[], requestId: string) =>
    request<{ game: PublicGame; marks: Mark[]; solved: boolean }>(
      `/api/word-games/${gameId}/guess`,
      { method: 'POST', body: JSON.stringify({ jamo, requestId }) }
    ),

  abandon: (gameId: string) =>
    request<{ game: PublicGame }>(`/api/word-games/${gameId}/abandon`, { method: 'POST' }),

  stats: () => request<StatsResponse>('/api/word-games/me/stats'),

  history: (page: number, size = 10) =>
    request<HistoryResponse>(`/api/word-games/me/history?page=${page}&size=${size}`),

  myWords: (period: string, page = 1, size = 20) =>
    request<MyWordsResponse>(`/api/word-games/me/words?period=${period}&page=${page}&size=${size}`),

  rankings: (type: string, period: string, page = 1, size = 20) =>
    request<RankingResponse>(
      `/api/word-games/rankings?type=${type}&period=${period}&page=${page}&size=${size}`
    ),

  wordRankings: (wordId: string, period: string, page = 1, size = 20) =>
    request<WordRankingResponse>(
      `/api/word-games/words/${wordId}/rankings?period=${period}&page=${page}&size=${size}`
    ),
};

export interface PeriodStats {
  started: number;
  finished: number;
  playing: number;
  success: number;
  failed: number;
  abandoned: number;
  winRate: number | null;
  avgAttempts: number | null;
  avgDurationMs: number | null;
  bestAttempts: number | null;
  bestAttemptsCount: number;
  bestDurationMs: number | null;
  maxStreak: number;
  dist: Record<string, number>;
}

export interface HistoryItem {
  gameId: string;
  wordId: string;
  word: string;
  status: Exclude<GameStatus, 'PLAYING'>;
  attemptsUsed: number;
  durationMs: number;
  endedAt: number;
  isFirstAttempt: boolean;
}

export interface StatsResponse {
  rule: RuleSummary;
  stats: Record<string, PeriodStats>;
  currentStreak: number;
  bestStreak: number;
  recent: HistoryItem[];
  note: string;
}

export interface HistoryResponse {
  items: HistoryItem[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
}

export interface MyWordsResponse {
  rule: RuleSummary;
  items: {
    wordId: string;
    word: string;
    status: Exclude<GameStatus, 'PLAYING'>;
    attemptsUsed: number;
    durationMs: number;
    endedAt: number;
  }[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
}

export interface RankingRow {
  rank: number | null;
  userId: number;
  nickname: string;
  avatar?: string;
  finished: number;
  success: number;
  winRate: number | null;
  avgAttempts: number | null;
  avgDurationMs: number | null;
  maxStreak: number;
  metric: number | null;
  isMe: boolean;
  missing?: { need: number; kind: 'finished' | 'success' } | null;
}

export interface RankingResponse {
  rule: RuleSummary;
  type: string;
  period: string;
  thresholds: { winRate: number; avgAttempts: number; avgTime: number };
  items: RankingRow[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
  me: RankingRow;
  note: string;
}

export interface WordRankingRow {
  rank: number | null;
  userId: number;
  nickname: string;
  avatar?: string;
  attemptsUsed?: number;
  durationMs?: number;
  endedAt?: number;
  isMe: boolean;
  reason?: string | null;
}

export interface WordRankingResponse {
  rule: RuleSummary;
  word: string;
  wordId: string;
  period: string;
  items: WordRankingRow[];
  page: number;
  size: number;
  total: number;
  hasNext: boolean;
  stats: {
    participants: number;
    successCount: number;
    successRate: number | null;
    avgAttempts: number | null;
    avgDurationMs: number | null;
  };
  me: WordRankingRow;
  myFirstAttempt: {
    status: GameStatus;
    attemptsUsed: number;
    durationMs: number | null;
    endedAt: number | null;
  };
  note: string;
}
