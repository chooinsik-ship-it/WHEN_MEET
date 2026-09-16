import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit, errorResponse, requireUser } from '../../../../lib/wordgame/api';
import { abandonGame } from '../../../../lib/wordgame/service';

/**
 * POST /api/word-games/{gameId}/abandon
 * 본인 진행 게임 포기
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'guess');

    const { gameId } = await params;
    const game = await abandonGame(userId, gameId);

    return NextResponse.json({ game });
  } catch (error) {
    return errorResponse(error);
  }
}
