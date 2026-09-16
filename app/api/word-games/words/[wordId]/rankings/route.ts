import { NextResponse, type NextRequest } from 'next/server';
import {
  enforceRateLimit,
  errorResponse,
  parsePaging,
  parsePeriod,
  requireUser,
} from '../../../../../lib/wordgame/api';
import { RULE_SUMMARY } from '../../../../../lib/wordgame/config';
import { getProfiles, getWordResults } from '../../../../../lib/wordgame/store';
import { buildWordRanking } from '../../../../../lib/wordgame/rankings';
import { requireWordAccess } from '../../../../../lib/wordgame/wordAccess';

/**
 * GET /api/word-games/words/{wordId}/rankings?period=all&page=1
 *
 * 같은 단어를 같은 규칙으로 푼 사용자끼리의 순위.
 * 각 사용자의 "최초 도전" 1건만 집계 대상이다.
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
    const { page, size, offset } = parsePaging(searchParams);

    const results = await getWordResults(wordId);
    const { rows, stats } = buildWordRanking(results, period);

    const pageRows = rows.slice(offset, offset + size);
    const myRow = rows.find((r) => r.userId === userId) ?? null;

    const needProfiles = new Set<number>(pageRows.map((r) => r.userId));
    needProfiles.add(userId);
    const profiles = await getProfiles([...needProfiles]);

    const decorate = (row: (typeof rows)[number]) => ({
      ...row,
      nickname: profiles.get(row.userId)?.nickname ?? '알 수 없음',
      avatar: profiles.get(row.userId)?.avatar,
      isMe: row.userId === userId,
    });

    /** 순위가 없다면 그 이유를 명확히 알려준다 */
    let myRankReason: string | null = null;
    if (!myRow) {
      if (myFirstGame.status === 'FAILED') myRankReason = 'FIRST_ATTEMPT_FAILED';
      else if (myFirstGame.status === 'ABANDONED') myRankReason = 'FIRST_ATTEMPT_ABANDONED';
      else myRankReason = 'OUT_OF_PERIOD';
    }

    return NextResponse.json({
      rule: RULE_SUMMARY,
      word: entry.word,
      wordId: entry.wordId,
      period,
      items: pageRows.map(decorate),
      page,
      size,
      total: rows.length,
      hasNext: offset + pageRows.length < rows.length,
      stats,
      me: myRow
        ? decorate(myRow)
        : {
            rank: null,
            userId,
            nickname: profiles.get(userId)?.nickname ?? '나',
            avatar: profiles.get(userId)?.avatar,
            reason: myRankReason,
            isMe: true,
          },
      myFirstAttempt: {
        status: myFirstGame.status,
        attemptsUsed: myFirstGame.attemptsUsed,
        durationMs: myFirstGame.durationMs,
        endedAt: myFirstGame.endedAt,
      },
      note: '단어별 랭킹에는 각 사용자의 최초 도전만 반영됩니다. 재도전 기록은 개인 통계와 종합 랭킹에만 반영됩니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
