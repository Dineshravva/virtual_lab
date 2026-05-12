import React, { useState } from 'react';

// Initial screen shown before the user enters the lab. Collects the
// room name they want to join.
export default function RoomJoin({ onJoin }) {
  const [roomName, setRoomName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = roomName.trim();
    if (trimmed) {
      onJoin(trimmed);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-lab-bg p-4">
      <div className="bg-lab-panel p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-800">
        <h1 className="text-3xl font-bold text-lab-accent mb-1">VIRTUAL-LAB</h1>
        <p className="text-gray-400 mb-6 text-sm">
          A collaborative 2D physics sandbox for university-level learning
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Room name</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. mechanics-101"
              autoFocus
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg
                         text-white focus:outline-none focus:border-lab-accent
                         placeholder-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={!roomName.trim()}
            className="w-full bg-lab-accent hover:bg-sky-400 disabled:opacity-50
                       disabled:cursor-not-allowed text-black font-semibold
                       py-2 rounded-lg transition"
          >
            Enter Lab
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-6">
          Share your room name with other students to collaborate in the same workspace.
        </p>
      </div>
    </div>
  );
}
