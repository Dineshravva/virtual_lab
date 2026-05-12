import React from 'react';

const STATUS_STYLES = {
  idle: { dot: 'bg-gray-500', label: 'Idle', cls: 'text-gray-400' },
  connecting: { dot: 'bg-amber-400 animate-pulse', label: 'Connecting', cls: 'text-amber-300' },
  connected: { dot: 'bg-emerald-400', label: 'Live', cls: 'text-emerald-300' },
  reconnecting: { dot: 'bg-amber-400 animate-pulse', label: 'Reconnecting', cls: 'text-amber-300' },
  error: { dot: 'bg-red-500', label: 'Offline', cls: 'text-red-300' }
};

export default function ConnectionStatus({ status = 'idle' }) {
  const config = STATUS_STYLES[status] || STATUS_STYLES.idle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900/80 px-2 py-0.5 text-[11px] font-medium ${config.cls}`}
      role="status"
      aria-live="polite"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
