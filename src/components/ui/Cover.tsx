import { useEffect, useState } from 'react';
import { cx } from './Button';
import styles from './Cover.module.css';

interface CoverProps {
  src: string | null | undefined;
  title: string;
  className?: string;
  /** Prioridade de carregamento (capas acima da dobra). */
  eager?: boolean;
}

/**
 * Capa 2:3. Enquanto carrega (ou se não houver/falhar) mostra uma "capa
 * tipográfica": o título em serifa no alto e uma lombada à esquerda, para a
 * grade nunca ter buracos.
 */
export function Cover({ src, title, className, eager = false }: CoverProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');

  useEffect(() => {
    setStatus(src ? 'loading' : 'error');
  }, [src]);

  return (
    <div className={cx(styles.cover, className)}>
      {status !== 'loaded' && (
        <div className={styles.placeholder} aria-hidden="true">
          {title.trim() && <span className={styles.title}>{title}</span>}
        </div>
      )}
      {src && status !== 'error' && (
        <img
          className={cx(styles.img, status === 'loaded' && styles.loaded)}
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  );
}
