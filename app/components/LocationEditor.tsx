'use client';

import { useState } from 'react';

interface LocationEditorProps {
  currentLocation?: string;
  onSave: (location: string) => void;
}

export default function LocationEditor({ currentLocation, onSave }: LocationEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentLocation ?? '');

  const handleSave = () => {
    onSave(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-black">
          {currentLocation ? currentLocation : <span className="text-gray-400">아직 입력하지 않았어요</span>}
        </span>
        <button
          onClick={() => { setValue(currentLocation ?? ''); setEditing(true); }}
          className="px-3 py-1 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
        >
          {currentLocation ? '수정' : '입력하기'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="예: 강남, 홍대, 노원, 강남구, 수원시"
        className="flex-1 px-3 py-2 border border-brand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 text-black text-sm"
        maxLength={30}
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
      />
      <button
        onClick={handleSave}
        className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
      >
        저장
      </button>
      <button
        onClick={() => setEditing(false)}
        className="px-3 py-2 text-sm bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition"
      >
        취소
      </button>
    </div>
  );
}
