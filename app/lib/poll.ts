/**
 * 약속 시간 투표 — 클라이언트/서버 공용 순수 로직
 *
 * 후보는 "시간대(18~20시)"가 아니라 "날짜 + 시작 시각(9월 30일 수 18:00)"이다.
 * 새벽·심야는 후보에서 제외하고, 날짜마다 가장 무난한 시작 시각 하나만 뽑는다.
 */

export interface PollCandidate {
  date: string; // YYYY-MM-DD (로컬 = KST)
  hour: number; // 시작 시각 0~23
}

export interface Poll {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  place?: string;
  duration: number; // 시간 단위
  candidates: PollCandidate[];
  members: string[];
  createdBy: string;
  createdAt: string;
  status: 'open' | 'confirmed' | 'cancelled';
  confirmed?: PollCandidate;
  appointmentId?: string;
}

/** 닉네임 → 투표한 후보 키 목록 ([] = 모두 안 됨) */
export type PollVotes = Record<string, string[]>;

export const POLL_LIMITS = {
  maxCandidates: 8,
  minDuration: 1,
  maxDuration: 6,
  maxMembers: 20,
  titleMax: 30,
  placeMax: 50,
};

/** 후보로 뽑는 시작 시각 범위 (새벽·심야 제외) */
export const EARLIEST_START = 10;
export const LATEST_START = 21;

const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

export const candidateKey = (c: PollCandidate) => `${c.date}T${c.hour}`;

export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 주간 시간표 인덱스 (0 = 월요일) */
export function weekdayIndex(date: string): number {
  return (parseDate(date).getDay() + 6) % 7;
}

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** "9월 30일(수) 18:00" — duration 을 주면 "9월 30일(수) 18:00~20:00" */
export function formatSlot(c: PollCandidate, duration?: number): string {
  const d = parseDate(c.date);
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW_LABEL[d.getDay()]}) ${hh(c.hour)}`;
  return duration ? `${base}~${hh(Math.min(24, c.hour + duration))}` : base;
}

export function isValidCandidate(c: unknown): c is PollCandidate {
  if (!c || typeof c !== 'object') return false;
  const { date, hour } = c as PollCandidate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (toDateKey(parseDate(date)) !== date) return false; // 2월 30일 같은 날짜 거부
  return Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

export interface SuggestedCandidate extends PollCandidate {
  /** 이 시간에 안 되는 멤버 */
  unavailable: string[];
}

interface SuggestOptions {
  members: string[];
  /** members 와 같은 순서의 주간 시간표 (true = 바쁨, [요일 0=월][시]) */
  schedules: boolean[][][];
  /** members 와 같은 순서의 날짜별 일정 (true = 그날 바쁨) */
  dateSchedules: Record<string, boolean>[];
  duration: number;
  now?: Date;
  days?: number;
  limit?: number;
}

/**
 * 후보 추천
 * 1) 앞으로 N일, 시작 시각 10~21시 중에서 duration 동안 되는 사람 수를 센다
 * 2) 날짜마다 "안 되는 사람이 가장 적고, 선호 시각에 가까운" 시작 시각 하나를 고른다
 *    선호 시각: 평일 19시(퇴근 후), 주말 14시
 * 3) 안 되는 사람이 적은 날 → 이른 날 순으로 limit 개
 * 과반이 안 되는 시간은 후보로 올리지 않는다.
 */
export function suggestCandidates({
  members,
  schedules,
  dateSchedules,
  duration,
  now = new Date(),
  days = 14,
  limit = 5,
}: SuggestOptions): SuggestedCandidate[] {
  const perDate: SuggestedCandidate[] = [];
  const todayKey = toDateKey(now);
  // 오늘은 최소 3시간 뒤부터 (지금 당장 모이자는 후보는 의미가 없다)
  const earliestToday = now.getHours() + 3;

  for (let offset = 0; offset < days; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const date = toDateKey(day);
    const wd = (day.getDay() + 6) % 7;
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const preferred = weekend ? 14 : 19;

    let best: SuggestedCandidate | null = null;
    for (let hour = EARLIEST_START; hour <= LATEST_START; hour++) {
      if (hour + duration > 24) break;
      if (date === todayKey && hour < earliestToday) continue;

      const unavailable = members.filter((_, i) => {
        if (dateSchedules[i]?.[date]) return true;
        const week = schedules[i];
        for (let k = 0; k < duration; k++) {
          if (week?.[wd]?.[hour + k]) return true;
        }
        return false;
      });
      if (unavailable.length * 2 >= members.length && members.length > 1) continue;

      const cand = { date, hour, unavailable };
      if (
        !best ||
        unavailable.length < best.unavailable.length ||
        (unavailable.length === best.unavailable.length &&
          Math.abs(hour - preferred) < Math.abs(best.hour - preferred))
      ) {
        best = cand;
      }
    }
    if (best) perDate.push(best);
  }

  return perDate
    .sort((a, b) => a.unavailable.length - b.unavailable.length || a.date.localeCompare(b.date))
    .slice(0, limit)
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
}

/** 후보별 득표 수 */
export function tally(poll: Pick<Poll, 'candidates'>, votes: PollVotes): Record<string, string[]> {
  const byKey: Record<string, string[]> = {};
  for (const c of poll.candidates) byKey[candidateKey(c)] = [];
  for (const [nickname, keys] of Object.entries(votes)) {
    for (const key of keys) byKey[key]?.push(nickname);
  }
  return byKey;
}

/** 최다 득표 후보 (동률이면 이른 시간). 아무도 가능하지 않으면 null */
export function pickWinner(poll: Pick<Poll, 'candidates'>, votes: PollVotes): PollCandidate | null {
  const counts = tally(poll, votes);
  const ordered = [...poll.candidates].sort(
    (a, b) => a.date.localeCompare(b.date) || a.hour - b.hour
  );
  let winner: PollCandidate | null = null;
  let max = 0;
  for (const c of ordered) {
    const n = counts[candidateKey(c)].length;
    if (n > max) {
      max = n;
      winner = c;
    }
  }
  return winner;
}

export function everyoneVoted(poll: Pick<Poll, 'members'>, votes: PollVotes): boolean {
  return poll.members.every(m => Array.isArray(votes[m]));
}

/** 닉네임 → 사용자 ID (클라이언트 storage.ts 의 nicknameToId 와 동일) */
export function nicknameToId(nickname: string): number {
  const hash = nickname.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
  return Math.abs(hash);
}
