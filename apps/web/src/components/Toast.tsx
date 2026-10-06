import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

import { ToastContext, type Notify } from '../lib/toast-context';
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; kind: string; time: number } | null>(
    null,
  );
  const notify = useCallback<Notify>(
    (message, kind = 'success') => setNotice({ message, kind, time: Date.now() }),
    [],
  );
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {notice && (
        <div
          key={notice.time}
          className={`toast ${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.kind === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{notice.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            <X size={18} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
