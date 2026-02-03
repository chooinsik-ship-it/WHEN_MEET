'use client';

import { GroupInvitation } from '../utils/storage';

interface GroupInvitationModalProps {
  invitation: GroupInvitation;
  onAccept: (invitation: GroupInvitation) => void;
  onDecline: (invitation: GroupInvitation) => void;
}

/**
 * 그룹 초대 모달 컴포넌트
 * 사용자가 로그인 시 대기 중인 그룹 초대가 있을 때 표시됨
 */
export default function GroupInvitationModal({
  invitation,
  onAccept,
  onDecline,
}: GroupInvitationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-fade-in">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">
            그룹 초대
          </h2>
        </div>

        {/* 초대 정보 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-center text-black mb-4">
            <span className="font-bold text-blue-600">{invitation.creatorNickname}</span>
            님이 <span className="font-bold text-blue-600">{invitation.groupName}</span> 그룹에 초대하셨습니다.
          </p>
          
          <div className="border-t border-gray-200 pt-3 mt-3">
            <p className="text-sm text-gray-600 mb-2">그룹 멤버:</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                {invitation.creatorNickname} (생성자)
              </span>
              {invitation.members.map((member, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {member}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-gray-700 mb-6">
          그룹에 참여하시겠습니까?
        </p>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={() => onDecline(invitation)}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition"
          >
            아니오
          </button>
          <button
            onClick={() => onAccept(invitation)}
            className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
          >
            예
          </button>
        </div>
      </div>
    </div>
  );
}
