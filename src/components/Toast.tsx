import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertTriangle, X, Info } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ─── Mapa de estilos por tipo ─────────────────────────────────────────────────

const TOAST_STYLES: Record<ToastType, { container: string; icon: ReactElement }> = {
  success: {
    container:
      'bg-emerald-950/95 border border-emerald-700/60 text-emerald-100 shadow-emerald-900/40',
    icon: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
  },
  error: {
    container:
      'bg-rose-950/95 border border-rose-700/60 text-rose-100 shadow-rose-900/40',
    icon: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
  },
  info: {
    container:
      'bg-slate-800/95 border border-slate-600/60 text-slate-100 shadow-slate-900/40',
    icon: <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />,
  },
};

// ─── Provider ────────────────────────────────────────────────────────────────

let nextId = 0;
const DURATION_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-label="Notificaciones"
          className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// ─── Ítem individual de Toast ─────────────────────────────────────────────────

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);

  // Animación de entrada
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const style = TOAST_STYLES[toast.type];

  return (
    <div
      role="status"
      className={`
        pointer-events-auto flex items-start gap-3
        max-w-[340px] w-full px-4 py-3 rounded-2xl
        shadow-xl backdrop-blur-md
        transition-all duration-300 ease-out
        ${style.container}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      {style.icon}
      <span className="text-sm font-medium leading-snug flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity mt-0.5"
        aria-label="Cerrar notificación"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Hook de consumo ──────────────────────────────────────────────────────────

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de un <ToastProvider>');
  return ctx;
}
