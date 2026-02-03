/**
 * 요일 배열 (월~일)
 */
const DAYS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

/**
 * 연속된 여유 시간대를 찾는 인터페이스
 */
interface TimeSlot {
  dayIdx: number;
  startHour: number;
  endHour: number; // inclusive (해당 시간 포함)
  duration: number; // 시간 단위
}

/**
 * 연속된 여유 시간대 인터페이스 (busyCount 추가)
 */
interface TimeSlotWithBusy extends TimeSlot {
  busyCount: number; // 바쁜 사람 수
}

/**
 * 모든 스케줄을 고려한 여유 시간대 찾기
 * - 각 시간대별로 바쁜 사람 수를 계산
 * - 연속된 시간대를 그룹화
 * 
 * @param allSchedules 모든 사람의 스케줄 배열
 * @returns 시간대 배열 (바쁜 사람 수 포함)
 */
export function findCommonFreeSlots(
  ...allSchedules: boolean[][][]
): TimeSlotWithBusy[] {
  const freeSlots: TimeSlotWithBusy[] = [];

  // 각 요일별로 탐색
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    let startHour = -1;
    let currentBusyCount = 0;

    // 각 시간대 탐색
    for (let hourIdx = 0; hourIdx < 24; hourIdx++) {
      // 이 시간에 바쁜 사람 수 계산
      const busyCount = allSchedules.filter(
        (schedule) => schedule[dayIdx][hourIdx]
      ).length;

      // 연속 구간 체크 (바쁜 사람 수가 같으면 계속)
      if (startHour === -1) {
        // 새 구간 시작
        startHour = hourIdx;
        currentBusyCount = busyCount;
      } else if (busyCount !== currentBusyCount) {
        // 바쁜 사람 수가 바뀌면 이전 구간 저장
        const duration = hourIdx - startHour;
        freeSlots.push({
          dayIdx,
          startHour,
          endHour: hourIdx - 1,
          duration,
          busyCount: currentBusyCount,
        });
        // 새 구간 시작
        startHour = hourIdx;
        currentBusyCount = busyCount;
      }
    }

    // 요일의 마지막까지 연속된 경우
    if (startHour !== -1) {
      const duration = 24 - startHour;
      freeSlots.push({
        dayIdx,
        startHour,
        endHour: 23,
        duration,
        busyCount: currentBusyCount,
      });
    }
  }

  return freeSlots;
}

/**
 * 가장 좋은 시간대를 찾는 함수
 * - 우선순위: 1) busyCount 낮은 순 (모두 여유 > 1명 바쁨 > 2명 바쁨...)
 *             2) duration 긴 순
 * 
 * @param freeSlots 시간대 배열
 * @returns 가장 좋은 시간대 또는 null
 */
export function findBestSlot(freeSlots: TimeSlotWithBusy[]): TimeSlotWithBusy | null {
  if (freeSlots.length === 0) return null;

  return freeSlots.reduce((best, current) => {
    // busyCount가 낮을수록 우선
    if (current.busyCount < best.busyCount) return current;
    if (current.busyCount > best.busyCount) return best;
    
    // busyCount가 같으면 duration이 길수록 우선
    return current.duration > best.duration ? current : best;
  });
}

/**
 * 추천 문구 생성 함수
 * - 모든 사람의 스케줄을 고려
 * - 우선순위: 모두 여유 > 1명 바쁨 > 2명 바쁨 순
 * - 같은 busyCount면 긴 시간대 우선
 * 
 * @param allSchedules 모든 사람의 스케줄 배열 (내 스케줄 포함)
 * @param minDuration 최소 연속 시간 (기본값: 2시간)
 * @returns 추천 문구
 */
export function generateRecommendation(
  allSchedules: boolean[][][],
  minDuration: number = 2
): string {
  // 모든 시간대 찾기
  const freeSlots = findCommonFreeSlots(...allSchedules);

  // 최소 시간 이상인 것만 필터링
  const validSlots = freeSlots.filter((slot) => slot.duration >= minDuration);

  if (validSlots.length === 0) {
    return '공통으로 여유로운 시간대가 없습니다. (최소 2시간 이상 필요)';
  }

  // 가장 좋은 시간대 찾기 (busyCount 낮은 순 -> duration 긴 순)
  const best = findBestSlot(validSlots);

  if (!best) {
    return '추천 시간대를 찾을 수 없습니다.';
  }

  // 문구 생성
  const dayName = DAYS[best.dayIdx];
  const { startHour, endHour, busyCount } = best;
  const totalPeople = allSchedules.length;
  const freePeople = totalPeople - busyCount;

  let statusText = '';
  if (busyCount === 0) {
    statusText = '모두 여유로워요! 🎉';
  } else if (busyCount === 1) {
    statusText = `${freePeople}명 여유 (1명 바쁨)`;
  } else {
    statusText = `${freePeople}명 여유 (${busyCount}명 바쁨)`;
  }

  return `추천: ${dayName} ${startHour}~${endHour + 1}시 - ${statusText} (${best.duration}시간)`;
}

/**
 * 모든 시간대를 문구로 변환 (디버깅/확장용)
 * 
 * @param freeSlots 시간대 배열
 * @returns 시간대 설명 배열
 */
export function formatTimeSlots(freeSlots: TimeSlotWithBusy[]): string[] {
  return freeSlots.map((slot) => {
    const dayName = DAYS[slot.dayIdx];
    const timeRange = slot.duration === 1
      ? `${slot.startHour}시`
      : `${slot.startHour}~${slot.endHour + 1}시`;
    return `${dayName} ${timeRange} (${slot.duration}시간, ${slot.busyCount}명 바쁨)`;
  });
}
