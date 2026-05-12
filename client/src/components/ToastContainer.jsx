import React from 'react';

const toneClasses = {
  error: 'border-red-500/60 bg-red-950/95 text-red-100',
  info: 'border-sky-500/60 bg-sky-950/95 text-sky-100',
  success: 'border-emerald-500/60 bg-emerald-950/95 text-emerald-100'
};

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-md border px-3 py-2 text-sm shadow-xl ${
            toneClasses[toast.type] || toneClasses.info
          }`}
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-current opacity-70 transition hover:opacity-100"
              aria-label="Dismiss notification"
            >
              X
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
