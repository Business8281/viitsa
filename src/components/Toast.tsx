import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, Info, XCircle, AlertTriangle, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  toast: (message: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastCtx | undefined>(undefined);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const config: Record<ToastKind, { icon: React.ReactNode; bg: string; text: string; iconColor: string }> = {
    success: { icon: <CheckCircle size={16} />, bg: 'bg-success-bg', text: 'text-success', iconColor: 'text-success' },
    error: { icon: <XCircle size={16} />, bg: 'bg-danger-bg', text: 'text-danger', iconColor: 'text-danger' },
    warning: { icon: <AlertTriangle size={16} />, bg: 'bg-warning-bg', text: 'text-warning', iconColor: 'text-warning' },
    info: { icon: <Info size={16} />, bg: 'bg-primary-50', text: 'text-primary', iconColor: 'text-primary' },
  };

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]">
        {toasts.map((t) => {
          const c = config[t.kind];
          return (
            <div
              key={t.id}
              className={`flex items-start gap-2.5 rounded-lg ${c.bg} px-4 py-3 shadow-card-hover animate-slide-up`}
            >
              <span className={`${c.iconColor} mt-0.5 shrink-0`}>{c.icon}</span>
              <p className={`text-sm font-medium ${c.text} flex-1`}>{t.message}</p>
              <button onClick={() => dismiss(t.id)} className={`${c.text} opacity-60 hover:opacity-100`}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
