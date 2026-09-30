'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  candidateKey,
  formatSlot,
  suggestCandidates,
  tally,
  toDateKey,
  type PollCandidate,
  type PollVotes,
  type Poll,
} from '../lib/poll';
import {
  cancelGroupPoll,
  confirmGroupPoll,
  createGroupPoll,
  loadGroupPoll,
  votePoll,
  type DateScheduleMap,
} from '../utils/storage';

interface GroupPollProps {
  groupId: string;
  groupName: string;
  /** 그룹 전체 멤버 (본인 포함) */
  members: string[];
  /** members 와 같은 순서 */
  schedules: boolean[][][];
  dateSchedules: DateScheduleMap[];
  currentUserNickname: string;
  /** 확정되어 약속 목록이 바뀌었을 때 */
  onConfirmed?: () => void;
}

const DURATIONS = [1, 2, 3, 4];
const CUSTOM_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07~22시

const sortCandidates = (list: PollCandidate[]) =>
  [...list].sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);

/**
 * 약속 시간 투표
 * 겹치는 시간에서 "날짜 + 시작 시각" 후보를 뽑아 멤버들이 가능한 후보에 투표한다.
 */
export default function GroupPoll({
  groupId,
  groupName,
  members,
  schedules,
  dateSchedules,
  currentUserNickname,
  onConfirmed,
}: GroupPollProps) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<PollVotes>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // 만들기 폼
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [duration, setDuration] = useState(2);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState<PollCandidate[]>([]);
  const [customDate, setCustomDate] = useState('');
  const [customHour, setCustomHour] = useState(19);

  // 내 투표 (제출 전 선택)
  const [mine, setMine] = useState<Set<string>>(new Set());

  const apply = (view: { poll: Poll | null; votes: PollVotes }) => {
    setPoll(view.poll);
    setVotes(view.votes);
    setMine(new Set(view.poll ? view.votes[currentUserNickname] ?? [] : []));
  };

  const refresh = async () => {
    setError('');
    try {
      apply(await loadGroupPoll(groupId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const suggestions = useMemo(
    () => suggestCandidates({ members, schedules, dateSchedules, duration }),
    [members, schedules, dateSchedules, duration]
  );

  // 약속 길이가 바뀌면 추천도 바뀌므로 기본 선택을 다시 잡는다
  useEffect(() => {
    setPicked(new Set(suggestions.map(candidateKey)));
  }, [suggestions]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => {
    setTitle('');
    setPlace('');
    setCustom([]);
    setCustomDate('');
    setCreating(true);
  };

  const formCandidates = sortCandidates([
    ...suggestions,
    ...custom.filter(c => !suggestions.some(s => candidateKey(s) === candidateKey(c))),
  ]);
  const chosen = formCandidates.filter(c => picked.has(candidateKey(c)));

  const togglePicked = (key: string) =>
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const addCustom = () => {
    if (!customDate) return;
    const c = { date: customDate, hour: customHour };
    const key = candidateKey(c);
    if (!formCandidates.some(x => candidateKey(x) === key)) setCustom(prev => [...prev, c]);
    setPicked(prev => new Set(prev).add(key));
  };

  const submitCreate = () =>
    run(async () => {
      if (chosen.length === 0) throw new Error('후보를 하나 이상 골라주세요.');
      if (chosen.length > 8) throw new Error('후보는 최대 8개까지예요.');
      apply(
        await createGroupPoll({
          groupId,
          groupName,
          title: title.trim() || '약속',
          place: place.trim() || undefined,
          duration,
          candidates: chosen.map(({ date, hour }) => ({ date, hour })),
          members,
        })
      );
      setCreating(false);
    });

  const submitVote = (keys: string[]) =>
    run(async () => {
      if (!poll) return;
      const view = await votePoll(poll.id, keys);
      apply(view);
      if (view.poll?.status === 'confirmed') onConfirmed?.();
    });

  const confirmAt = (key: string) =>
    run(async () => {
      if (!poll) return;
      apply(await confirmGroupPoll(poll.id, key));
      onConfirmed?.();
    });

  const cancel = () =>
    run(async () => {
      if (!poll || !window.confirm(`[${poll.title}] 투표를 취소할까요?`)) return;
      await cancelGroupPoll(poll.id);
      apply({ poll: null, votes: {} });
    });

  const today = toDateKey(new Date());
  const maxDate = toDateKey(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

  const box = 'mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg';
  const heading = 'text-base font-bold text-amber-700';

  if (loading) {
    return (
      <div className={box}>
        <h3 className={heading}>🗳️ 약속 시간 투표</h3>
        <p className="text-sm text-gray-500 mt-2">불러오는 중...</p>
      </div>
    );
  }

  /* ---------------------------------------------------------- 투표 만들기 */
  if (creating) {
    return (
      <div className={box}>
        <h3 className={`${heading} mb-1`}>🗳️ 약속 시간 투표 만들기</h3>
        <p className="text-xs text-gray-500 mb-3">
          멤버 시간표에서 겹치는 시간을 찾아 날짜별로 시작 시각을 추천했어요. (10~21시 시작, 새벽·심야 제외)
        </p>

        <div className="flex flex-col gap-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="약속 이름 (예: 저녁 약속)"
            maxLength={30}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            value={place}
            onChange={e => setPlace(e.target.value)}
            placeholder="📍 장소 (선택)"
            maxLength={50}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-700">약속 길이</span>
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer transition ${
                  duration === d
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {d}시간
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm font-semibold text-gray-800 mt-4 mb-2">후보 ({chosen.length}개 선택)</p>
        {formCandidates.length === 0 ? (
          <p className="text-xs text-gray-500 mb-2">
            앞으로 2주 동안 과반이 되는 시간이 없어요. 아래에서 직접 추가해 주세요.
          </p>
        ) : (
          <div className="space-y-1.5">
            {formCandidates.map(c => {
              const key = candidateKey(c);
              const suggestion = suggestions.find(s => candidateKey(s) === key);
              const on = picked.has(key);
              return (
                <button
                  key={key}
                  onClick={() => togglePicked(key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left cursor-pointer transition ${
                    on ? 'bg-white border-amber-400' : 'bg-white/50 border-gray-200 opacity-60'
                  }`}
                >
                  <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center text-[10px] ${on ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300'}`}>
                    {on ? '✓' : ''}
                  </span>
                  <span className="text-sm font-semibold text-black">{formatSlot(c)}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {!suggestion
                      ? '직접 추가'
                      : suggestion.unavailable.length === 0
                        ? '전원 가능'
                        : `${suggestion.unavailable.join(', ')} 어려움`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
          <input
            type="date"
            value={customDate}
            min={today}
            max={maxDate}
            onChange={e => setCustomDate(e.target.value)}
            className="px-2 py-1.5 border border-amber-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <select
            value={customHour}
            onChange={e => setCustomHour(Number(e.target.value))}
            className="px-2 py-1.5 border border-amber-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
          >
            {CUSTOM_HOURS.map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00 시작</option>
            ))}
          </select>
          <button
            onClick={addCustom}
            disabled={!customDate}
            className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 font-semibold rounded-lg hover:bg-amber-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + 후보 추가
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setCreating(false)}
            className="flex-1 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition cursor-pointer text-sm"
          >
            취소
          </button>
          <button
            onClick={submitCreate}
            disabled={busy || chosen.length === 0}
            className="flex-[2] py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? '여는 중...' : `투표 열기 (멤버 ${members.length - 1}명에게 알림)`}
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- 투표 없음 */
  if (!poll || poll.status === 'cancelled') {
    return (
      <div className={box}>
        <h3 className={heading}>🗳️ 약속 시간 투표</h3>
        <p className="text-sm text-gray-700 mt-1">
          겹치는 시간 중에서 날짜·시작 시각 후보를 뽑아 투표로 정해요. 전원이 투표하면 가장 많이 고른 시간으로 자동 확정돼요.
        </p>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <button
          onClick={startCreate}
          className="mt-3 w-full py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition cursor-pointer text-sm"
        >
          투표 열기
        </button>
      </div>
    );
  }

  /* ---------------------------------------------------------- 확정됨 */
  if (poll.status === 'confirmed' && poll.confirmed) {
    return (
      <div className="mt-6 p-4 bg-green-50 border border-green-300 rounded-lg">
        <h3 className="text-base font-bold text-green-700">✅ 약속 확정</h3>
        <p className="text-sm text-black mt-1">
          <span className="font-bold">[{poll.title}]</span> {formatSlot(poll.confirmed, poll.duration)}
        </p>
        {poll.place && <p className="text-xs text-gray-600 mt-0.5">장소 : {poll.place}</p>}
        <p className="text-xs text-gray-500 mt-1">멤버 모두의 약속 목록에 추가됐어요.</p>
        <button
          onClick={startCreate}
          className="mt-3 w-full py-2 bg-white border border-amber-300 text-amber-700 font-semibold rounded-lg hover:bg-amber-50 transition cursor-pointer text-sm"
        >
          새 투표 열기
        </button>
      </div>
    );
  }

  /* ---------------------------------------------------------- 진행 중 */
  const counts = tally(poll, votes);
  const voted = poll.members.filter(m => Array.isArray(votes[m]));
  const waiting = poll.members.filter(m => !Array.isArray(votes[m]));
  const iVoted = Array.isArray(votes[currentUserNickname]);
  const isCreator = poll.createdBy === currentUserNickname;
  const total = poll.members.length;
  const best = Math.max(0, ...Object.values(counts).map(v => v.length));
  const unchanged =
    iVoted &&
    mine.size === votes[currentUserNickname].length &&
    votes[currentUserNickname].every(k => mine.has(k));

  const toggleMine = (key: string) =>
    setMine(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={box}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className={heading}>🗳️ [{poll.title}] 언제 만날까요?</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {poll.createdBy}님이 연 투표 · {poll.duration}시간 약속{poll.place ? ` · ${poll.place}` : ''}
          </p>
        </div>
        <button
          onClick={() => run(refresh)}
          disabled={busy}
          className="text-xs text-amber-700 hover:underline cursor-pointer flex-shrink-0"
        >
          ↻ 새로고침
        </button>
      </div>

      <p className="text-xs text-gray-600 mt-2">가능한 시간을 모두 골라주세요.</p>

      <div className="space-y-1.5 mt-2">
        {sortCandidates(poll.candidates).map(c => {
          const key = candidateKey(c);
          const voters = counts[key] ?? [];
          const on = mine.has(key);
          const leading = voters.length > 0 && voters.length === best;
          return (
            <div
              key={key}
              className={`rounded-lg border bg-white transition ${on ? 'border-amber-400' : 'border-gray-200'}`}
            >
              <button
                onClick={() => toggleMine(key)}
                className="w-full flex items-center gap-2 px-3 pt-2 text-left cursor-pointer"
              >
                <span className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center text-[10px] ${on ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300'}`}>
                  {on ? '✓' : ''}
                </span>
                <span className="text-sm font-semibold text-black">{formatSlot(c)}</span>
                {leading && <span className="text-[10px] bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full font-semibold">최다</span>}
                <span className="ml-auto text-xs font-semibold text-gray-700">{voters.length}/{total}</span>
              </button>
              <div className="px-3 pb-2 pt-1">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${(voters.length / total) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1 gap-2">
                  <span className="text-[11px] text-gray-500 truncate">{voters.length > 0 ? voters.join(', ') : '아직 없음'}</span>
                  {isCreator && voters.length > 0 && (
                    <button
                      onClick={() => confirmAt(key)}
                      disabled={busy}
                      className="text-[11px] text-green-700 font-semibold hover:underline cursor-pointer flex-shrink-0"
                    >
                      이 시간으로 확정
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        투표 완료 {voted.length}/{total}
        {waiting.length > 0 && ` · 기다리는 중: ${waiting.join(', ')}`}
      </p>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => submitVote([])}
          disabled={busy}
          className="flex-1 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition cursor-pointer text-sm disabled:opacity-50"
        >
          다 안 돼요
        </button>
        <button
          onClick={() => submitVote([...mine])}
          disabled={busy || mine.size === 0 || unchanged}
          className="flex-[2] py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? '저장 중...' : iVoted ? (unchanged ? '투표 완료' : '투표 수정') : '투표하기'}
        </button>
      </div>

      {isCreator && (
        <button onClick={cancel} disabled={busy} className="mt-2 w-full text-xs text-gray-400 hover:text-red-500 cursor-pointer">
          투표 취소
        </button>
      )}
    </div>
  );
}
