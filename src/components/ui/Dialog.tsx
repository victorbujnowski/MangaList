import { useEffect, useRef, useState, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { prefersReducedMotion } from '../../lib/viewTransition';
import { Button, cx } from './Button';
import styles from './Dialog.module.css';

const EXIT_MS = 180;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Linha pequena acima do título (versalete). */
  eyebrow?: ReactNode;
  children: ReactNode;
  /** Rodapé fixo (ações). */
  footer?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * Diálogo modal sobre <dialog> nativo: foco preso, Esc e `inert` no resto da
 * página vêm de graça. No celular vira folha que sobe da base.
 * Mantém o conteúdo montado durante a animação de saída.
 */
export function Dialog({ open, onClose, title, eyebrow, children, footer, size = 'md', className }: DialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const titleId = useId();

  // Abre/fecha acompanhando `open`, com tempo para a animação de saída.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return undefined;
    }
    if (!mounted) return undefined;
    if (prefersReducedMotion()) {
      setMounted(false);
      return undefined;
    }
    setClosing(true);
    const id = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => window.clearTimeout(id);
  }, [open, mounted]);

  useEffect(() => {
    const el = ref.current;
    if (!mounted || !el) return undefined;
    if (!el.open) el.showModal();
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
      if (el.open) el.close();
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size], closing && styles.closing, className)}
      aria-labelledby={titleId}
      // Esc: deixamos o React controlar o fechamento (para animar).
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Clique fora do painel (no backdrop) fecha.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <div className={styles.headText}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          </div>
          <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('close')} icon={<X />} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.foot}>{footer}</footer>}
      </div>
    </dialog>
  );
}
