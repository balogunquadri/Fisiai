'use client';

import { useEffect } from 'react';

type ToastProps = {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
};

const typeStyles = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-rose-500 text-white',
  info: 'bg-slate-700 text-white',
};

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onClose]);

  return (
    <div className={`pointer-events-auto fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-white/10 px-4 py-3 shadow-2xl shadow-slate-950/20 ${typeStyles[type]}`}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
        >
          Close
        </button>
      </div>
    </div>
  );
}
