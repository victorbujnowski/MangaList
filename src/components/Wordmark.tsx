import styles from './Wordmark.module.css';

/**
 * Marca: três lombadas (a do meio em vermelho, "em leitura") + nome em serifa.
 * Mesmo desenho de public/icon.svg.
 */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`${styles.wordmark} ${styles[size]}`}>
      <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="5" height="15" fill="currentColor" />
        <rect x="9.5" y="3" width="5" height="18" fill="var(--accent)" />
        <rect x="16" y="7" width="5" height="14" fill="currentColor" transform="rotate(8 18.5 21)" />
      </svg>
      <span className={styles.name}>MangaList</span>
    </span>
  );
}
