import { cx } from './Button';
import styles from './Loader.module.css';

interface LoaderProps {
  /** Texto para leitores de tela (ex.: "Carregando…"). */
  label: string;
  size?: number;
  /** Ocupa a tela inteira, centralizado (abertura do app). */
  fullscreen?: boolean;
  className?: string;
}

/**
 * Ícone do MangaList animado: as três lombadas sobem da prateleira em
 * sequência (a vermelha, "em leitura", no meio) e a última inclina, como no
 * logo. Só aparece depois de ~150 ms para não piscar em carregamentos rápidos.
 * O mesmo desenho existe estático em index.html (antes do JS carregar).
 */
export function Loader({ label, size = 56, fullscreen = false, className }: LoaderProps) {
  return (
    <div className={cx(styles.wrap, fullscreen && styles.fullscreen, className)} role="status" aria-live="polite">
      <svg className={styles.mark} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect className={cx(styles.spine, styles.s1)} x="3" y="6" width="5" height="15" />
        <rect className={cx(styles.spine, styles.s2)} x="9.5" y="3" width="5" height="18" />
        <rect className={cx(styles.spine, styles.s3)} x="16" y="7" width="5" height="14" />
        <rect className={styles.shelf} x="1.5" y="21" width="21" height="1.2" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
