'use client';

import { useEffect, useState } from 'react';
import OverlapGrid from './OverlapGrid';
import { loadSchedule, loadUser, Appointment } from '../utils/storage';
import { generateRecommendation } from '../utils/recommendation';
import { addressToCoordinate, recommendSubwayStations } from '../utils/subway';

interface GroupScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  memberNicknames: string[];
  creatorNickname: string;
  appointments?: Appointment[];
  onAddAppointment?: (appt: Omit<Appointment, 'id' | 'createdAt' | 'participants'>) => void;
  onAppointmentClick?: (appt: Appointment) => void;
  /** 현재 로그인한 사용자 닉네임 */
  currentUserNickname?: string;
  /** 현재 사용자의 친구 닉네임 목록 */
  friendNicknames?: string[];
  /** 그룹에 새 멤버를 초대할 때 호출 (nickname, isFriend) */
  onInviteMember?: (nickname: string, isFriend: boolean) => void;
  /** 그룹명 수정 시 호출 */
  onGroupNameChange?: (newName: string) => void;
}

/**
 * 빈 스케줄 초기화 함수
 */
function createEmptySchedule(): boolean[][] {
  return Array(7).fill(null).map(() => Array(24).fill(false));
}

/**
 * 닉네임을 해시하여 ID 생성
 */
function nicknameToId(nickname: string): number {
  const hash = nickname.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return Math.abs(hash);
}

export default function GroupScheduleModal({
  isOpen,
  onClose,
  groupName,
  memberNicknames,
  creatorNickname,
  appointments = [],
  onAddAppointment,
  onAppointmentClick,
  currentUserNickname,
  friendNicknames = [],
  onInviteMember,
  onGroupNameChange,
}: GroupScheduleModalProps) {
  const [allSchedules, setAllSchedules] = useState<boolean[][][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subwayRecommendations, setSubwayRecommendations] = useState<ReturnType<typeof recommendSubwayStations>>([]);
  const [missingLocations, setMissingLocations] = useState<string[]>([]);
  const [apptName, setApptName] = useState('');
  const [apptDay, setApptDay] = useState(0);
  const [apptStart, setApptStart] = useState(14);
  const [apptEnd, setApptEnd] = useState(16);
  const [inviteInput, setInviteInput] = useState('');
  // 그룹명 인라인 편집
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState(groupName);
  // 개별 멤버 시간표 보기
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  useEffect(() => { setEditNameInput(groupName); }, [groupName]);

  useEffect(() => {
    if (isOpen) {
      loadMemberSchedules();
    }
  }, [isOpen, memberNicknames]);

  const loadMemberSchedules = async () => {
    setIsLoading(true);
    
    const allMembers = [creatorNickname, ...memberNicknames];

    // 스케줄 + 거주지 동시 로드
    const [schedules, userData] = await Promise.all([
      Promise.all(allMembers.map(async (nickname) => {
        const id = nicknameToId(nickname);
        const schedule = await loadSchedule(id);
        return schedule || createEmptySchedule();
      })),
      Promise.all(allMembers.map(async (nickname) => {
        const id = nicknameToId(nickname);
        const user = await loadUser(id);
        return { nickname, location: user?.location as string | undefined };
      })),
    ]);

    setAllSchedules(schedules);

    // 거주지 기반 지하철 추천
    const locations: Array<{ lat: number; lng: number }> = [];
    const missing: string[] = [];
    userData.forEach(({ nickname, location }) => {
      if (location) {
        const coord = addressToCoordinate(location);
        if (coord) locations.push(coord);
        else missing.push(nickname);
      } else {
        missing.push(nickname);
      }
    });

    setMissingLocations(missing);
    if (locations.length >= 2) {
      setSubwayRecommendations(recommendSubwayStations(locations, 5));
    } else {
      setSubwayRecommendations([]);
    }

    setIsLoading(false);
  };

  const recommendation = allSchedules.length > 0
    ? generateRecommendation(allSchedules)
    : '';

  if (!isOpen) return null;

  const allMemberNames = [creatorNickname, ...memberNicknames];
  const selectedMemberIdx = selectedMember ? allMemberNames.indexOf(selectedMember) : -1;
  const selectedMemberSchedule = selectedMemberIdx >= 0 ? allSchedules[selectedMemberIdx] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            {isEditingName ? (
              <input
                autoFocus
                value={editNameInput}
                onChange={(e) => setEditNameInput(e.target.value)}
                onBlur={() => {
                  const name = editNameInput.trim() || groupName;
                  onGroupNameChange?.(name);
                  setIsEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const name = editNameInput.trim() || groupName;
                    onGroupNameChange?.(name);
                    setIsEditingName(false);
                  }
                  if (e.key === 'Escape') {
                    setEditNameInput(groupName);
                    setIsEditingName(false);
                  }
                }}
                className="text-2xl font-bold text-black border-b-2 border-blue-400 focus:outline-none bg-transparent w-full max-w-xs"
                maxLength={30}
              />
            ) : (
              <h2
                onClick={() => onGroupNameChange && setIsEditingName(true)}
                className={`text-2xl font-bold text-black flex items-center gap-2 ${
                  onGroupNameChange ? 'cursor-pointer hover:text-blue-600 group' : ''
                }`}
              >
                {groupName}
                {onGroupNameChange && (
                  <span className="text-sm text-gray-400 font-normal opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                )}
              </h2>
            )}
            <p className="text-sm text-gray-500 mt-1">
              생성자: {creatorNickname} | 멤버: {memberNicknames.length}명
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="overflow-y-auto flex-1">
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">스케줄을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 멤버 목록 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-black mb-3">참여 멤버</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedMember(selectedMember === creatorNickname ? null : creatorNickname)}
                    className={`px-3 py-1 text-sm rounded-full transition cursor-pointer ${
                      selectedMember === creatorNickname
                        ? 'bg-brand-600 text-white ring-2 ring-brand-400'
                        : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                    }`}
                  >
                    {creatorNickname} (생성자)
                  </button>
                  {memberNicknames.map((nickname, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedMember(selectedMember === nickname ? null : nickname)}
                      className={`px-3 py-1 text-sm rounded-full transition cursor-pointer ${
                        selectedMember === nickname
                          ? 'bg-brand-600 text-white ring-2 ring-brand-400'
                          : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                      }`}
                    >
                      {nickname}
                    </button>
                  ))}
                </div>
                {selectedMember && (
                  <p className="text-xs text-gray-500 mt-2">
                    💡 클릭한 멤버의 시간표를 보고 있습니다. 다시 클릭하거나{' '}
                    <button onClick={() => setSelectedMember(null)} className="text-blue-500 hover:underline cursor-pointer">전체 보기</button>
                    로 돌아갈 수 있습니다.
                  </p>
                )}
              </div>

              {/* 겹치는 스케줄 표시 */}
              {selectedMember && selectedMemberSchedule ? (
                <div>
                  <h3 className="text-base font-semibold text-gray-700 mb-3">
                    📅 <span className="text-brand-600 font-bold">{selectedMember}</span>의 시간표
                  </h3>
                  <OverlapGrid
                    schedule1={selectedMemberSchedule}
                    schedule2={createEmptySchedule()}
                    allSchedules={[selectedMemberSchedule]}
                    participantNames={[selectedMember]}
                  />
                </div>
              ) : (
                <OverlapGrid
                  schedule1={allSchedules[0] || createEmptySchedule()}
                  schedule2={allSchedules[1] || createEmptySchedule()}
                  allSchedules={allSchedules}
                  participantNames={[creatorNickname, ...memberNicknames]}
                />
              )}

              {/* 추천 문구 */}
              {recommendation && (
                <div className="mt-6 p-4 bg-brand-50 border-l-4 border-brand-400 rounded">
                  <h3 className="text-lg font-bold text-black mb-2">
                    만남 추천
                  </h3>
                  <p className="text-black">{recommendation}</p>
                </div>
              )}

              {/* 지하철역 추천 */}
              {subwayRecommendations.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-500 rounded">
                  <h3 className="text-lg font-bold text-black mb-3">🚇 중간 지점 지하철역 추천</h3>
                  <div className="space-y-2">
                    {subwayRecommendations.map((station, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-bold text-black">{station.name}</p>
                            <p className="text-sm text-gray-600">{station.line}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">평균 거리</p>
                          <p className="font-semibold text-green-600">{station.avgDistance.toFixed(1)}km</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">💡 모든 멤버의 거주지를 고려한 중간 지점입니다</p>
                </div>
              )}

              {/* 거주지 정보 부족 */}
              {subwayRecommendations.length === 0 && missingLocations.length > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                  <h3 className="text-lg font-bold text-black mb-2">📍 거주지 정보가 필요해요</h3>
                  <p className="text-sm text-gray-700">
                    거주지 미입력 멤버: <span className="font-semibold">{missingLocations.join(', ')}</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-1">모든 멤버가 거주지를 입력하면 중간 지점을 추천해드려요!</p>
                </div>
              )}

              {/* 확정된 약속 목록 */}
              {appointments.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-base font-bold text-blue-700 mb-2">📋 확정된 약속</h3>
                  {appointments.map(appt => {
                    const dayName = ['월','화','수','목','금','토','일'][appt.day];
                    const isPending = appt.status === 'pending';
                    return (
                      <div
                        key={appt.id}
                        onClick={() => onAppointmentClick?.(appt)}
                        className={`p-3 rounded-lg cursor-pointer transition hover:opacity-85 ${
                          isPending ? 'bg-yellow-200 text-gray-800' : 'bg-blue-500 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-bold">{appt.name}</p>
                          {isPending && <span className="text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-semibold">⏳ 수락 대기중</span>}
                        </div>
                        <p className={`text-sm mt-0.5 ${isPending ? 'text-gray-600' : 'text-blue-100'}`}>
                          {dayName}요일 {String(appt.startHour).padStart(2,'0')}:00 ~ {String(appt.endHour).padStart(2,'0')}:00
                        </p>
                        <p className={`text-xs mt-0.5 ${isPending ? 'text-gray-500' : 'text-blue-200'}`}>{appt.participants.join(', ')}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 약속 확정하기 폼 */}
              {onAddAppointment && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-base font-bold text-blue-700 mb-3">📅 약속 확정하기</h3>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={apptName}
                      onChange={(e) => setApptName(e.target.value)}
                      placeholder="약속 이름 (예: 저녁 약속)"
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      maxLength={30}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <select value={apptDay} onChange={(e) => setApptDay(Number(e.target.value))} className="px-2 py-1.5 border border-blue-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
                        {['월요일','화요일','수요일','목요일','금요일','토요일','일요일'].map((d,i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                      <select value={apptStart} onChange={(e) => setApptStart(Number(e.target.value))} className="px-2 py-1.5 border border-blue-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
                        {Array.from({length:24},(_,i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                      <span className="text-blue-600 font-semibold">~</span>
                      <select value={apptEnd} onChange={(e) => setApptEnd(Number(e.target.value))} className="px-2 py-1.5 border border-blue-200 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer">
                        {Array.from({length:24},(_,i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        if (apptStart >= apptEnd) { alert('종료 시간은 시작 시간보다 늦어야 합니다.'); return; }
                        onAddAppointment({ name: apptName.trim() || '약속', day: apptDay, startHour: apptStart, endHour: apptEnd });
                        setApptName('');
                      }}
                      className="w-full py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition cursor-pointer text-sm"
                    >
                      약속 확정하기
                    </button>
                  </div>
                </div>
              )}

              {/* 그룹 초대하기 */}
              {onInviteMember && (() => {
                const alreadyInGroup = new Set([creatorNickname, ...memberNicknames]);
                const invitableFriends = friendNicknames.filter(n => !alreadyInGroup.has(n));
                const inputTrimmed = inviteInput.trim();
                const inputIsFriend = friendNicknames.includes(inputTrimmed);
                const inputAlreadyIn = alreadyInGroup.has(inputTrimmed);
                const inputIsSelf = inputTrimmed === currentUserNickname;
                return (
                  <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h3 className="text-base font-bold text-purple-700 mb-3">👥 그룹 초대하기</h3>

                    {/* 친구 목록 (그룹 미참여자만) */}
                    {invitableFriends.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2 font-medium">💙 친구 목록</p>
                        <div className="flex flex-wrap gap-2">
                          {invitableFriends.map(nickname => (
                            <button
                              key={nickname}
                              onClick={() => onInviteMember(nickname, true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-300 rounded-full text-sm hover:bg-purple-100 transition cursor-pointer"
                            >
                              <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold">친구</span>
                              <span className="text-black">{nickname}</span>
                              <span className="text-purple-400 text-xs">+ 초대</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 직접 입력 */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inviteInput}
                        onChange={(e) => setInviteInput(e.target.value)}
                        placeholder="닉네임으로 초대"
                        className="flex-1 px-3 py-2 border border-purple-200 rounded-lg text-black text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        maxLength={20}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && inputTrimmed && !inputAlreadyIn && !inputIsSelf) {
                            onInviteMember(inputTrimmed, inputIsFriend);
                            setInviteInput('');
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (!inputTrimmed) return;
                          if (inputAlreadyIn) { alert('이미 그룹에 있는 멤버입니다.'); return; }
                          if (inputIsSelf) { alert('자기 자신은 초대할 수 없습니다.'); return; }
                          onInviteMember(inputTrimmed, inputIsFriend);
                          setInviteInput('');
                        }}
                        className="px-4 py-2 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition text-sm cursor-pointer"
                      >
                        초대
                      </button>
                    </div>

                    {/* 비친구 경고 */}
                    {inputTrimmed && !inputIsFriend && !inputAlreadyIn && !inputIsSelf && (
                      <p className="text-xs text-amber-600 mt-1.5">⚠️ 친구가 아닌 사용자입니다. 상대방에게 주의 메시지가 표시됩니다.</p>
                    )}
                    {inputAlreadyIn && (
                      <p className="text-xs text-red-500 mt-1.5">이미 그룹에 참여 중인 멤버입니다.</p>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
        </div>

        {/* 푸터 */}
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
