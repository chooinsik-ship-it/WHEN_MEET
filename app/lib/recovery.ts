/**
 * 비밀번호 복구 코드 (서버 전용)
 *
 * 이 서비스에는 이메일·전화번호가 없어서 메일로 재설정 링크를 보낼 수 없다.
 * 대신 사용자가 보관하는 **복구 코드**를 쓴다.
 *  - 발급 시 평문은 화면에 1회만 보여주고, 서버에는 해시만 저장한다
 *  - 코드로 비밀번호를 재설정하면 그 코드는 즉시 폐기된다(1회용)
 *  - 무차별 대입을 막기 위해 시도 횟수를 제한한다
 */
import { createHash, randomInt } from 'crypto';

/** 헷갈리는 글자(0/O, 1/I/L) 제외 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = 4;
const GROUP_SIZE = 4;

/** 복구 코드 시도 제한: 1시간에 10회 */
export const RESET_ATTEMPT_LIMIT = 10;
export const RESET_ATTEMPT_WINDOW_SEC = 60 * 60;

export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = '';
    for (let i = 0; i < GROUP_SIZE; i++) group += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(group);
  }
  return groups.join('-');
}

/** 입력 정규화 — 공백·소문자·하이픈 차이를 흡수한다 */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashCode(code: string): string {
  return createHash('sha256').update('whenmeet_recovery_' + normalizeCode(code)).digest('hex');
}

export const recoveryKey = (userId: string | number) => `recovery:${userId}`;

/** 재설정 시도 횟수 제한 (userId 단위) */
export async function checkResetAttempts(userId: string | number): Promise<boolean> {
  const { kv } = await import('@vercel/kv');
  const window = Math.floor(Date.now() / (RESET_ATTEMPT_WINDOW_SEC * 1000));
  const key = `recovery-attempts:${userId}:${window}`;

  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, RESET_ATTEMPT_WINDOW_SEC + 60);
  return count <= RESET_ATTEMPT_LIMIT;
}
