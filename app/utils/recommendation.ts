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
 * 공통 여유 시간대를 찾는 함수
 * - 두 스케줄에서 둘 다 여유(false)인 시간대를 찾음
 * - 각 요일별로 연속된 시간대를 탐색
 * 
 * @param schedule1 사용자1의 스케줄
 * @param schedule2 사용자2의 스케줄
 * @returns 공통 여유 시간대 배열
 */
export function findCommonFreeSlots(
  schedule1: boolean[][],
  schedule2: boolean[][]
): TimeSlot[] {
  const freeSlots: TimeSlot[] = [];

  // 각 요일별로 탐색
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    let startHour = -1;

    // 각 시간대 탐색
    for (let hourIdx = 0; hourIdx < 24; hourIdx++) {
      const isBothFree = !schedule1[dayIdx][hourIdx] && !schedule2[dayIdx][hourIdx];

      if (isBothFree) {
        // 연속 구간 시작
        if (startHour === -1) {
          startHour = hourIdx;
        }
      } else {
        // 연속 구간 종료
        if (startHour !== -1) {
          const duration = hourIdx - startHour;
          freeSlots.push({
            dayIdx,
            startHour,
            endHour: hourIdx - 1,
            duration,
          });
          startHour = -1;
        }
      }
    }

    // 요일의 마지막까지 여유 시간이 계속된 경우
    if (startHour !== -1) {
      const duration = 24 - startHour;
      freeSlots.push({
        dayIdx,
        startHour,
        endHour: 23,
        duration,
      });
    }
  }

  return freeSlots;
}

/**
 * 가장 긴 공통 여유 시간대를 찾는 함수
 * 
 * @param freeSlots 공통 여유 시간대 배열
 * @returns 가장 긴 시간대 또는 null
 */
export function findLongestSlot(freeSlots: TimeSlot[]): TimeSlot | null {
  if (freeSlots.length === 0) return null;

  return freeSlots.reduce((longest, current) => {
    return current.duration > longest.duration ? current : longest;
  });
}

/**
 * 추천 문구 생성 함수
 * - 최소 2시간 이상의 공통 여유 시간대 중 가장 긴 구간을 찾아 추천
 * 
 * @param schedule1 사용자1의 스케줄
 * @param schedule2 사용자2의 스케줄
 * @param minDuration 최소 연속 시간 (기본값: 2시간)
 * @returns 추천 문구
 */
export function generateRecommendation(
  schedule1: boolean[][],
  schedule2: boolean[][],
  minDuration: number = 2
): string {
  // 모든 공통 여유 시간대 찾기
  const freeSlots = findCommonFreeSlots(schedule1, schedule2);

  // 최소 시간 이상인 것만 필터링
  const validSlots = freeSlots.filter((slot) => slot.duration >= minDuration);

  if (validSlots.length === 0) {
    return '공통으로 여유로운 시간대가 없습니다. (최소 2시간 이상 필요)';
  }

  // 가장 긴 구간 찾기
  const longest = findLongestSlot(validSlots);

  if (!longest) {
    return '추천 시간대를 찾을 수 없습니다.';
  }

  // 문구 생성
  const dayName = DAYS[longest.dayIdx];
  const { startHour, endHour } = longest;

  // 시간 범위가 연속된 경우 범위로 표시
  if (endHour - startHour >= 1) {
    return `추천: ${dayName} ${startHour}~${endHour + 1}시에 만나세요! (${longest.duration}시간 여유)`;
  } else {
    // 1시간만 여유인 경우 (실제로는 minDuration=2라서 발생 안 함)
    return `추천: ${dayName} ${startHour}시에 만나세요!`;
  }
}

/**
 * 모든 공통 여유 시간대를 문구로 변환 (디버깅/확장용)
 * 
 * @param freeSlots 공통 여유 시간대 배열
 * @returns 시간대 설명 배열
 */
export function formatTimeSlots(freeSlots: TimeSlot[]): string[] {
  return freeSlots.map((slot) => {
    const dayName = DAYS[slot.dayIdx];
    if (slot.duration === 1) {
      return `${dayName} ${slot.startHour}시`;
    }
    return `${dayName} ${slot.startHour}~${slot.endHour + 1}시 (${slot.duration}시간)`;
  });
}
