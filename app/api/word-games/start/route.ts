import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit, errorResponse, requireUser } from '../../../lib/wordgame/api';
import { startGame, toPublicGame } from '../../../lib/wordgame/service';
import { RULE_SUMMARY } from '../../../lib/wordgame/config';

/**
 * POST /api/word-games/start
 * 새 게임 생성. 정답과 정답 단어 ID는 응답에 포함하지 않는다.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'start');

    const game = await startGame(userId);

    return NextResponse.json({
      game: toPublicGame(game),
      rule: RULE_SUMMARY,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
