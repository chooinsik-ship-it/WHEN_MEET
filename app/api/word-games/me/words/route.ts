import { NextResponse, type NextRequest } from 'next/server';
import {
  enforceRateLimit,
  errorResponse,
  parsePaging,
  parsePeriod,
  requireUser,
} from '../../../../lib/wordgame/api';
import { RULE_SUMMARY } from '../../../../lib/wordgame/config';
import { periodStartTs } from '../../../../lib/wordgame/time';
import { getUserWords } from '../../../../lib/wordgame/store';

/**
 * GET /api/word-games/me/words
 * 최초 도전이 "종료된" 단어만 돌려준다.
 * → 진행 중이거나 아직 만나지 않은 단어는 목록에 나타나지 않으므로 정답이 새지 않는다.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'read');

    const { searchParams } = new URL(request.url);
    const period = parsePeriod(searchParams.get('period'));
    const { page, size, offset } = parsePaging(searchParams);

    const start = periodStartTs(period);
    const all = (await getUserWords(userId))
      .filter((w) => w.endedAt >= start)
      .sort((a, b) => b.endedAt - a.endedAt);

    const items = all.slice(offset, offset + size);

    return NextResponse.json({
      rule: RULE_SUMMARY,
      items,
      page,
      size,
      total: all.length,
      hasNext: offset + items.length < all.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
