import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Ilustração: por padrão, uma estante vazia desenhada a traço. */
  art?: ReactNode;
}

function ShelfArt() {
  return (
    <svg className={styles.art} viewBox="0 0 120 64" fill="none" aria-hidden="true">
      <rect x="22" y="14" width="12" height="42" stroke="currentColor" strokeWidth="1.5" />
      <rect x="38" y="8" width="12" height="48" fill="var(--accent)" />
      <rect
        x="56"
        y="22"
        width="12"
        height="36"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        transform="rotate(10 62 56)"
      />
      <path d="M10 57.25h100" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function EmptyState({ title, children, action, art }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {art ?? <ShelfArt />}
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
