import styles from './ObraCardSkeleton.module.css';

/**
 * Card-fantasma enquanto as obras carregam. Mesma forma do ObraCard (capa 2:3,
 * título, linha de capítulo) para o layout não "pular" quando os dados chegam.
 */
export default function ObraCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className={styles.card} style={{ animationDelay: `${index * 60}ms` }} aria-hidden="true">
      <div className={styles.cover} />
      <div className={styles.lineTitle} />
      <div className={styles.lineSub} />
      <div className={styles.lineCap} />
    </div>
  );
}
