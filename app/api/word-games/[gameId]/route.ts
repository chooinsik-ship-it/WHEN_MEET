import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit, errorResponse, requireUser } from '../../../lib/wordgame/api';
import { loadOwnGame, toPublicGame } from '../../../lib/wordgame/service';

/**
 * GET /api/word-games/{gameId}
 * 본인 게임 상태 조회. 다른 사용자의 게임은 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'read');

    const { gameId } = await params;
    const game = await loadOwnGame(userId, gameId);

    return NextResponse.json({ game: toPublicGame(game) });
  } catch (error) {
    return errorResponse(error);
  }
}
