/**
 * 웹 푸시 (서버 전용)
 *
 * VAPID 키는 환경변수 대신 KV 에 한 번 생성해 보관한다.
 * (새 환경변수 설정 없이 동작 — 세션 서명 키와 같은 방식)
 *
 * 저장 구조
 *   push:vapid            { publicKey, privateKey }
 *   push:subs:<userId>    { [endpoint]: PushSubscriptionJSON }
 */
import webpush from 'web-push';

const VAPID_KEY = 'push:vapid';
const SUBJECT = 'mailto:noreply@whenmeet.vercel.app';

export const isKvConfigured = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cached: VapidKeys | null = null;

async function kvClient() {
  const { kv } = await import('@vercel/kv');
  return kv;
}

/** VAPID 키 쌍 (없으면 최초 1회 생성) */
export async function getVapidKeys(): Promise<VapidKeys | null> {
  if (cached) return cached;
  if (!isKvConfigured) return null;

  const kv = await kvClient();
  const existing = await kv.get<VapidKeys>(VAPID_KEY);
  if (existing?.publicKey && existing?.privateKey) {
    cached = existing;
    return existing;
  }

  const generated = webpush.generateVAPIDKeys();
  // 동시 생성 경쟁 방지 — 먼저 쓴 쪽의 키를 쓴다
  const stored = await kv.set(VAPID_KEY, generated, { nx: true });
  cached = stored ? generated : (await kv.get<VapidKeys>(VAPID_KEY)) ?? generated;
  return cached;
}

export async function getPublicKey(): Promise<string | null> {
  const keys = await getVapidKeys();
  return keys?.publicKey ?? null;
}

const subsKey = (userId: number) => `push:subs:${userId}`;

export async function saveSubscription(userId: number, sub: StoredSubscription): Promise<void> {
  const kv = await kvClient();
  const map = (await kv.get<Record<string, StoredSubscription>>(subsKey(userId))) ?? {};
  map[sub.endpoint] = sub;
  await kv.set(subsKey(userId), map);
}

export async function removeSubscription(userId: number, endpoint: string): Promise<void> {
  const kv = await kvClient();
  const map = (await kv.get<Record<string, StoredSubscription>>(subsKey(userId))) ?? {};
  if (map[endpoint]) {
    delete map[endpoint];
    await kv.set(subsKey(userId), map);
  }
}

export async function countSubscriptions(userId: number): Promise<number> {
  if (!isKvConfigured) return 0;
  const kv = await kvClient();
  const map = (await kv.get<Record<string, StoredSubscription>>(subsKey(userId))) ?? {};
  return Object.keys(map).length;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * 사용자의 모든 기기로 푸시 발송.
 * 만료된 구독(404/410)은 자동으로 정리한다.
 * 알림 저장 흐름을 막지 않도록 실패해도 예외를 던지지 않는다.
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  if (!isKvConfigured) return 0;

  try {
    const keys = await getVapidKeys();
    if (!keys) return 0;

    const kv = await kvClient();
    const map = (await kv.get<Record<string, StoredSubscription>>(subsKey(userId))) ?? {};
    const subs = Object.values(map);
    if (subs.length === 0) return 0;

    webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);

    const dead: string[] = [];
    let sent = 0;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) dead.push(sub.endpoint);
          else console.error('[push] 발송 실패:', status, (error as Error).message);
        }
      })
    );

    if (dead.length > 0) {
      for (const endpoint of dead) delete map[endpoint];
      await kv.set(subsKey(userId), map);
    }

    return sent;
  } catch (error) {
    console.error('[push] 처리 중 오류:', error);
    return 0;
  }
}
