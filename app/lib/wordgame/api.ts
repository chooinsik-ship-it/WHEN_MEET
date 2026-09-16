/**
 * 게임 API 공통 헬퍼 (인증 · 오류 · 입력 검증)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { PERIODS, RANKING_TYPES, RATE_LIMITS, MAX_PAGE_SIZE, PAGE_SIZE, type Period, type RankingType } from './config';
import { GameError } from './service';
import { checkRateLimit, isKvConfigured } from './store';
import { getUserIdFromRequest } from './session';

/** 로그인 확인 — 요청 본문의 userId 는 절대 신뢰하지 않는다 */
export async function requireUser(request: NextRequest): Promise<number> {
  if (!isKvConfigured) {
    throw new GameError('KV_NOT_CONFIGURED', '서버 저장소가 설정되지 않았습니다.', 503);
  }
  const userId = await getUserIdFromRequest(request);
  if (userId === null) {
    throw new GameError('UNAUTHORIZED', '로그인이 필요합니다. 로그아웃 후 다시 로그인해주세요.', 401);
  }
  return userId;
}

export async function enforceRateLimit(
  userId: number,
  action: keyof typeof RATE_LIMITS
): Promise<void> {
  const limit = RATE_LIMITS[action];
  const ok = await checkRateLimit(userId, action, limit.windowSec, limit.max);
  if (!ok) {
    throw new GameError('RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 429);
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof GameError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('[word-game] unexpected error:', error);
  return NextResponse.json({ error: '서버 오류가 발생했습니다.', code: 'INTERNAL' }, { status: 500 });
}

/** 허용값 검증 — 잘못된 필터는 기본값으로 떨어뜨리지 않고 오류로 돌려준다 */
export function parsePeriod(value: string | null): Period {
  if (value === null) return 'all';
  if ((PERIODS as string[]).includes(value)) return value as Period;
  throw new GameError('INVALID_PERIOD', `period 는 ${PERIODS.join(', ')} 중 하나여야 합니다.`, 422);
}

export function parseRankingType(value: string | null): RankingType {
  if (value === null) return 'success';
  if ((RANKING_TYPES as string[]).includes(value)) return value as RankingType;
  throw new GameError('INVALID_TYPE', `type 은 ${RANKING_TYPES.join(', ')} 중 하나여야 합니다.`, 422);
}

export function parsePaging(searchParams: URLSearchParams): { page: number; size: number; offset: number } {
  const pageRaw = searchParams.get('page');
  const sizeRaw = searchParams.get('size');

  const page = pageRaw === null ? 1 : Number(pageRaw);
  const size = sizeRaw === null ? PAGE_SIZE : Number(sizeRaw);

  if (!Number.isInteger(page) || page < 1) {
    throw new GameError('INVALID_PAGE', 'page 는 1 이상의 정수여야 합니다.', 422);
  }
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw new GameError('INVALID_SIZE', `size 는 1 ~ ${MAX_PAGE_SIZE} 사이여야 합니다.`, 422);
  }

  return { page, size, offset: (page - 1) * size };
}
