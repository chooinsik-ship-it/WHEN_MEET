import { NextResponse, type NextRequest } from 'next/server';
import {
  enforceRateLimit,
  errorResponse,
  parsePeriod,
  requireUser,
} from '../../../../../lib/wordgame/api';
import { RULE_SUMMARY } from '../../../../../lib/wordgame/config';
import { getWordResults } from '../../../../../lib/wordgame/store';
import { buildWordRanking } from '../../../../../lib/wordgame/rankings';
import { requireWordAccess } from '../../../../../lib/wordgame/wordAccess';

/**
 * GET /api/word-games/words/{wordId}/stats?period=all
 * 단어별 최초 도전 통계 (참여자 수·성공률·평균 시도·평균 시간)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wordId: string }> }
) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'read');

    const { wordId } = await params;
    const { entry, myFirstGame } = await requireWordAccess(userId, wordId);

    const { searchParams } = new URL(request.url);
    const period = parsePeriod(searchParams.get('period'));

    const results = await getWordResults(wordId);
    const { stats } = buildWordRanking(results, period);

    return NextResponse.json({
      rule: RULE_SUMMARY,
      wordId: entry.wordId,
      word: entry.word,
      period,
      stats,
      myFirstAttempt: {
        status: myFirstGame.status,
        attemptsUsed: myFirstGame.attemptsUsed,
        durationMs: myFirstGame.durationMs,
        endedAt: myFirstGame.endedAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
