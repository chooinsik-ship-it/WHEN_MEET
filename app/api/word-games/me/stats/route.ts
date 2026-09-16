import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit, errorResponse, requireUser } from '../../../../lib/wordgame/api';
import { PERIODS, RULE_SUMMARY } from '../../../../lib/wordgame/config';
import { bucketForPeriod } from '../../../../lib/wordgame/time';
import { getAgg, getHistory } from '../../../../lib/wordgame/store';
import { getCurrentGame } from '../../../../lib/wordgame/service';
import type { UserAgg } from '../../../../lib/wordgame/types';

/** 평균값은 기록이 없으면 0이 아니라 null → UI에서 '기록 없음'으로 표시 */
function summarize(agg: UserAgg, playing: number) {
  return {
    started: agg.started,
    finished: agg.finished,
    playing,
    success: agg.success,
    failed: agg.failed,
    abandoned: agg.abandoned,
    winRate: agg.finished > 0 ? agg.success / agg.finished : null,
    avgAttempts: agg.success > 0 ? agg.attemptsSum / agg.success : null,
    avgDurationMs: agg.success > 0 ? agg.durationSum / agg.success : null,
    bestAttempts: agg.bestAttempts,
    bestAttemptsCount: agg.bestAttemptsCount,
    bestDurationMs: agg.bestDurationMs,
    maxStreak: agg.maxStreak,
    dist: agg.dist,
  };
}

/**
 * GET /api/word-games/me/stats
 * 오늘 · 주간 · 월간 · 전체 통계를 한 번에 돌려준다.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'read');

    const now = Date.now();
    const current = await getCurrentGame(userId);
    const playing = current ? 1 : 0;

    const aggs = await Promise.all(
      PERIODS.map((period) => getAgg(bucketForPeriod(period, now), userId))
    );

    const stats: Record<string, ReturnType<typeof summarize>> = {};
    PERIODS.forEach((period, i) => {
      // 진행 중 게임은 '전체'와 '오늘' 기준으로만 노출 (시작 시각 기준)
      stats[period] = summarize(aggs[i], period === 'all' ? playing : playing);
    });

    const allAgg = aggs[PERIODS.indexOf('all')];
    const recent = await getHistory(userId, 0, 10);

    return NextResponse.json({
      rule: RULE_SUMMARY,
      stats,
      /** 현재 연속 성공은 전체 종료 기록 기준 */
      currentStreak: allAgg.curStreak,
      bestStreak: allAgg.maxStreak,
      recent,
      note: '반복 플레이한 게임도 모두 개인 통계와 종합 랭킹에 집계됩니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
