import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import styles from './Toast.module.css';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION: Record<ToastTone, number> = { success: 3200, info: 3200, error: 6000 };

/**
 * Avisos discretos no canto (base no celular). Erros ficam mais tempo e são
 * anunciados com prioridade (role="alert"); o resto vai em role="status".
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      // No máximo 3 na tela: o mais antigo sai.
      setItems((list) => [...list.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DURATION[tone]);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region}>
        {items.map((item) => (
          <div
            key={item.id}
            className={`${styles.toast} ${styles[item.tone]}`}
            role={item.tone === 'error' ? 'alert' : 'status'}
          >
            <span className={styles.icon} aria-hidden="true">
              {item.tone === 'error' ? <AlertCircle /> : <Check />}
            </span>
            <p className={styles.message}>{item.message}</p>
            <button type="button" className={styles.dismiss} onClick={() => dismiss(item.id)} aria-label={t('toast_dismiss')}>
              <X />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}
