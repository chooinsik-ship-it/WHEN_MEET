/**
 * 단어별 정보 접근 제어
 *
 * 정답 유출 방지가 목적이다.
 * - 클라이언트가 임의의 wordId 를 넣어도, 그 사용자가 "최초 도전을 끝낸" 단어가 아니면 403
 * - 사전에 없는 wordId 와 아직 도전하지 않은 wordId 를 같은 응답으로 처리해
 *   사전 구성 자체를 탐색하지 못하게 한다
 */
import { GameError } from './service';
import { getEntryById, type DictionaryEntry } from './dictionary';
import { getFirstAttemptGameId, getGame } from './store';
import type { GameRecord } from './types';

const DENY = () =>
  new GameError(
    'WORD_LOCKED',
    '최초 도전을 마친 단어만 볼 수 있습니다.',
    403
  );

export async function requireWordAccess(
  userId: number,
  wordId: string
): Promise<{ entry: DictionaryEntry; myFirstGame: GameRecord }> {
  const entry = getEntryById(wordId);
  if (!entry) throw DENY();

  const gameId = await getFirstAttemptGameId(userId, wordId);
  if (!gameId) throw DENY();

  const game = await getGame(gameId);
  if (!game || game.userId !== userId) throw DENY();

  // 진행 중이면 아직 정답을 알면 안 된다
  if (game.status === 'PLAYING') {
    throw new GameError(
      'WORD_IN_PROGRESS',
      '진행 중인 게임의 단어 정보는 게임이 끝난 뒤에 볼 수 있습니다.',
      403
    );
  }

  return { entry, myFirstGame: game };
}
