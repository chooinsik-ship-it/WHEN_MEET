import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit, errorResponse, requireUser } from '../../../../lib/wordgame/api';
import { submitGuess } from '../../../../lib/wordgame/service';
import { getIdempotentResult, saveIdempotentResult } from '../../../../lib/wordgame/store';

/**
 * POST /api/word-games/{gameId}/guess
 * body: { jamo: string[], requestId?: string }
 *
 * requestId 를 보내면 네트워크 재시도로 같은 제출이 두 번 처리되지 않는다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const userId = await requireUser(request);
    await enforceRateLimit(userId, 'guess');

    const { gameId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      jamo?: unknown;
      requestId?: unknown;
    };

    const requestId = typeof body.requestId === 'string' ? body.requestId.slice(0, 100) : null;

    if (requestId) {
      const cached = await getIdempotentResult<Record<string, unknown>>(gameId, requestId);
      if (cached) {
        return NextResponse.json({ ...cached, idempotent: true });
      }
    }

    const outcome = await submitGuess(userId, gameId, body.jamo);
    const payload = { game: outcome.game, marks: outcome.marks, solved: outcome.solved };

    if (requestId) await saveIdempotentResult(gameId, requestId, payload);

    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(error);
  }
}
