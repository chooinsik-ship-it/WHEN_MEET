import { NextResponse, type NextRequest } from 'next/server';
import {
  enforceRateLimit,
  errorResponse,
  parsePaging,
  parsePeriod,
  parseRankingType,
  requireUser,
} from '../../../lib/wordgame/api';
import {
  MIN_FINISHED_FOR_RATE_RANKING,
  MIN_SUCCESS_FOR_AVG_RANKING,
  RULE_SUMMARY,
} from '../../../lib/wordgame/config';
import { bucketForPeriod } from '../../../lib/wordgame/time';
import { getAgg, getAggMany, getProfiles, listAggUserIds } from '../../../lib/wordgame/store';
import { buildRanking, missingForEligibility, toRow } from '../../../lib/wordgame/rankings';

/**
 * GET /api/word-games/rankings?type=success&period=all&page=1
 *
 * 규칙(ruleId)별로 분리된 집계만 사용하므로 자모 칸 수·시도 횟수·규칙 버전이
 * 다른 기록이 한 랭킹에 섞이지 않는다.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'read');

    const { searchParams } = new URL(request.url);
    const type = parseRankingType(searchParams.get('type'));
    const period = parsePeriod(searchParams.get('period'));
    const { page, size, offset } = parsePaging(searchParams);

    const bucket = bucketForPeriod(period);
    const userIds = await listAggUserIds(bucket);
    const aggMap = await getAggMany(bucket, userIds);

    const baseRows = userIds
      .map((id) => {
        const agg = aggMap.get(id);
        return agg ? { ...toRow(id, agg), nickname: '', avatar: undefined as string | undefined } : null;
      })
      .filter(Boolean) as ReturnType<typeof toRow>[] & { nickname: string }[];

    const ranked = buildRanking(type, baseRows as never);

    const pageRows = ranked.slice(offset, offset + size);
    const myIndex = ranked.findIndex((r) => r.userId === userId);

    // 표시 정보는 현재 페이지 + 내 순위만 조회
    const needProfiles = new Set<number>(pageRows.map((r) => r.userId));
    if (myIndex >= 0) needProfiles.add(ranked[myIndex].userId);
    const profiles = await getProfiles([...needProfiles]);

    const decorate = (row: (typeof ranked)[number], rank: number) => ({
      rank,
      userId: row.userId,
      nickname: profiles.get(row.userId)?.nickname ?? '알 수 없음',
      avatar: profiles.get(row.userId)?.avatar,
      finished: row.finished,
      success: row.success,
      winRate: row.winRate,
      avgAttempts: row.avgAttempts,
      avgDurationMs: row.avgDurationMs,
      maxStreak: row.maxStreak,
      metric: row.metric,
      isMe: row.userId === userId,
    });

    // 내 순위: 조건 미달이면 남은 게임 수를 안내
    const myAgg = await getAgg(bucket, userId);
    const myBase = toRow(userId, myAgg);
    const missing = missingForEligibility(type, myBase);

    return NextResponse.json({
      rule: RULE_SUMMARY,
      type,
      period,
      thresholds: {
        winRate: MIN_FINISHED_FOR_RATE_RANKING,
        avgAttempts: MIN_SUCCESS_FOR_AVG_RANKING,
        avgTime: MIN_SUCCESS_FOR_AVG_RANKING,
      },
      items: pageRows.map((row, i) => decorate(row, offset + i + 1)),
      page,
      size,
      total: ranked.length,
      hasNext: offset + pageRows.length < ranked.length,
      me:
        myIndex >= 0
          ? decorate(ranked[myIndex], myIndex + 1)
          : {
              rank: null,
              userId,
              nickname: (await getProfiles([userId])).get(userId)?.nickname ?? '나',
              finished: myBase.finished,
              success: myBase.success,
              winRate: myBase.winRate,
              avgAttempts: myBase.avgAttempts,
              avgDurationMs: myBase.avgDurationMs,
              maxStreak: myBase.maxStreak,
              metric: null,
              isMe: true,
              missing,
            },
      note: '같은 단어를 다시 풀어도 개인 통계와 종합 랭킹에는 모두 집계됩니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
