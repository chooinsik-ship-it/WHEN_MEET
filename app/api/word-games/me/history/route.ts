import { NextResponse, type NextRequest } from 'next/server';
import {
  enforceRateLimit,
  errorResponse,
  parsePaging,
  requireUser,
} from '../../../../lib/wordgame/api';
import { getHistory, historyLength } from '../../../../lib/wordgame/store';

/**
 * GET /api/word-games/me/history?page=1&size=20
 * 개인 플레이 기록 (최신순, 페이지네이션)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'read');

    const { searchParams } = new URL(request.url);
    const { page, size, offset } = parsePaging(searchParams);

    const [items, total] = await Promise.all([
      getHistory(userId, offset, size),
      historyLength(userId),
    ]);

    return NextResponse.json({
      items,
      page,
      size,
      total,
      hasNext: offset + items.length < total,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
