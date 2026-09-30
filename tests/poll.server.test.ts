/**
 * 약속 시간 투표 서버 로직 테스트 (인메모리 KV 사용)
 * 실행: npm run test:poll:server
 */
import test, { before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeKv } from './fake-kv.mjs';

const fakeKv = createFakeKv();
mock.module('@vercel/kv', { exports: { kv: fakeKv } });

process.env.KV_REST_API_URL = 'https://fake.upstash.io';
process.env.KV_REST_API_TOKEN = 'fake-token';

type StoreModule = typeof import('../app/lib/pollStore.ts');
type PollModule = typeof import('../app/lib/poll.ts');

let store: StoreModule;
let lib: PollModule;

before(async () => {
  store = await import('../app/lib/pollStore.ts');
  lib = await import('../app/lib/poll.ts');
});

function makePoll(id: string, members: string[]) {
  return {
    id,
    groupId: `g-${id}`,
    groupName: '테스트그룹',
    title: '저녁',
    place: '강남역',
    duration: 2,
    candidates: [
      { date: '2026-10-01', hour: 19 },
      { date: '2026-10-03', hour: 14 },
    ],
    members,
    createdBy: members[0],
    createdAt: new Date().toISOString(),
    status: 'open' as const,
  };
}

const notificationsOf = async (nickname: string) =>
  (await fakeKv.get(`notifications:${lib.nicknameToId(nickname)}`)) as { type: string; message: string }[] | null;
const appointmentsOf = async (nickname: string) =>
  (await fakeKv.get(`appointments:${lib.nicknameToId(nickname)}`)) as Record<string, unknown>[] | null;

test('투표를 열면 만든 사람은 전 후보에 투표되고, 나머지에게 알림이 간다', async () => {
  const view = await store.createPoll(makePoll('p1', ['가', '나', '다']));
  assert.deepEqual(view.votes['가'], ['2026-10-01T19', '2026-10-03T14']);

  const group = await store.getGroupPoll('g-p1');
  assert.equal(group?.poll.id, 'p1');

  assert.equal((await notificationsOf('나'))?.[0].type, 'poll_open');
  assert.equal(await notificationsOf('가'), null, '만든 사람에게는 알림을 보내지 않는다');
});

test('전원이 투표하면 최다 득표 후보로 자동 확정되고 모두의 약속 목록에 들어간다', async () => {
  const poll = makePoll('p2', ['라', '마', '바']);
  await store.createPoll(poll);

  let view = await store.castVote(poll, '마', ['2026-10-03T14', '없는후보']);
  assert.equal(view.poll.status, 'open');
  assert.deepEqual(view.votes['마'], ['2026-10-03T14'], '없는 후보 키는 버린다');

  view = await store.castVote(poll, '바', ['2026-10-03T14']);
  assert.equal(view.poll.status, 'confirmed');
  assert.deepEqual(view.poll.confirmed, { date: '2026-10-03', hour: 14 });

  for (const m of ['라', '마', '바']) {
    const list = await appointmentsOf(m);
    assert.equal(list?.length, 1);
    const appt = list![0];
    assert.equal(appt.date, '2026-10-03');
    assert.equal(appt.day, 5); // 토요일
    assert.equal(appt.startHour, 14);
    assert.equal(appt.endHour, 16);
    assert.equal(appt.status, 'confirmed');
    assert.equal(appt.place, '강남역');
    assert.equal((await notificationsOf(m))?.[0].type, 'poll_confirmed');
  }
});

test('확정은 한 번만 처리된다 (자동·수동 확정이 겹쳐도)', async () => {
  const poll = makePoll('p3', ['사', '아']);
  await store.createPoll(poll);
  await store.confirmPoll(poll, poll.candidates[0]);
  await store.confirmPoll(poll, poll.candidates[1]);

  const list = await appointmentsOf('아');
  assert.equal(list?.length, 1);
  assert.equal(list![0].date, '2026-10-01');
  assert.deepEqual((await store.getPoll('p3'))?.confirmed, poll.candidates[0]);
});

test('모두 "안 돼요"면 확정하지 않는다', async () => {
  const poll = makePoll('p4', ['자', '차']);
  await store.createPoll(poll);
  // 만든 사람도 투표를 바꿔서 전부 불가
  await store.castVote(poll, '자', []);
  const view = await store.castVote(poll, '차', []);
  assert.equal(view.poll.status, 'open');
  assert.equal(await appointmentsOf('차'), null);
});

test('투표 취소 후에는 그룹의 진행 중 투표가 없다', async () => {
  const poll = makePoll('p5', ['카', '타']);
  await store.createPoll(poll);
  await store.cancelPoll(poll);
  assert.equal(await store.getGroupPoll('g-p5'), null);
  assert.equal((await store.getPoll('p5'))?.status, 'cancelled');
});
