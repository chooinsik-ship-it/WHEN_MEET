/**
 * 테스트용 인메모리 KV (@vercel/kv 의 최소 구현)
 * 게임 진행·집계 로직을 실제 Redis 없이 검증하기 위한 것.
 */
export function createFakeKv() {
  const store = new Map();

  const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

  return {
    __store: store,

    async get(key) {
      return clone(store.get(key));
    },

    async set(key, value, opts = {}) {
      if (opts.nx && store.has(key)) return null;
      store.set(key, clone(value));
      return 'OK';
    },

    async del(key) {
      return store.delete(key) ? 1 : 0;
    },

    async incr(key) {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },

    async expire() {
      return 1;
    },

    async mget(...keys) {
      return keys.map((k) => clone(store.get(k)));
    },

    async sadd(key, member) {
      const set = store.get(key) ?? [];
      if (!set.includes(String(member))) set.push(String(member));
      store.set(key, set);
      return 1;
    },

    async smembers(key) {
      return [...(store.get(key) ?? [])];
    },

    async lpush(key, value) {
      const list = store.get(key) ?? [];
      list.unshift(clone(value));
      store.set(key, list);
      return list.length;
    },

    async ltrim(key, start, stop) {
      const list = store.get(key) ?? [];
      store.set(key, list.slice(start, stop + 1));
      return 'OK';
    },

    async lrange(key, start, stop) {
      const list = store.get(key) ?? [];
      const end = stop === -1 ? list.length : stop + 1;
      return list.slice(start, end).map(clone);
    },

    async llen(key) {
      return (store.get(key) ?? []).length;
    },
  };
}
