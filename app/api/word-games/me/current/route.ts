import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit, errorResponse, requireUser } from '../../../../lib/wordgame/api';
import { getCurrentGame, toPublicGame } from '../../../../lib/wordgame/service';
import { RULE_SUMMARY } from '../../../../lib/wordgame/config';

/**
 * GET /api/word-games/me/current
 * 진행 중인 게임 복구 (새로고침·다른 기기 접속 시 이어서 플레이)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'read');

    const game = await getCurrentGame(userId);

    return NextResponse.json({
      game: game ? toPublicGame(game) : null,
      rule: RULE_SUMMARY,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
