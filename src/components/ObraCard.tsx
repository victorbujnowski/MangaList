import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Minus, Plus } from 'lucide-react';
import { STATUS_CONFIG, isStatusKey, stepChapter } from '../lib/constants';
import { useI18n } from '../i18n/I18nContext';
import type { Obra, PublicObra } from '../types';
import { Cover } from './ui/Cover';
import { cx } from './ui/Button';
import styles from './ObraCard.module.css';

interface ObraCardProps {
  obra: Obra | PublicObra;
  onEdit?: (obra: Obra) => void;
  onUpdateCap?: (id: string, capitulo: string) => void;
  readOnly?: boolean;
  /** Índice na grade: escalona a animação de entrada e prioriza as primeiras capas. */
  index?: number;
}

function ObraCard({ obra, onEdit, onUpdateCap, readOnly = false, index = 0 }: ObraCardProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [capInput, setCapInput] = useState(obra.capituloAtual);
  const [bump, setBump] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCap = useRef(obra.capituloAtual);

  const statusKey = isStatusKey(obra.status) ? obra.status : 'lendo';
  const statusLabel = t(`status.${statusKey}`);
  const tipoLabel = t(`tipo.${obra.tipo || 'manga'}`);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Destaca o número quando o capítulo muda de verdade (não no 1º render).
  useEffect(() => {
    setCapInput(obra.capituloAtual);
    if (prevCap.current !== obra.capituloAtual) {
      prevCap.current = obra.capituloAtual;
      setBump(true);
    }
  }, [obra.capituloAtual]);

  function commitCap() {
    const next = capInput.trim();
    if (next && next !== obra.capituloAtual) onUpdateCap?.(obra.id, next);
    else setCapInput(obra.capituloAtual);
    setEditing(false);
  }

  function step(delta: 1 | -1) {
    const next = stepChapter(obra.capituloAtual, delta);
    if (next !== null && next !== obra.capituloAtual) onUpdateCap?.(obra.id, next);
  }

  const canStepDown = stepChapter(obra.capituloAtual, -1) !== null && Number(obra.capituloAtual) > 0;

  const style = {
    '--status-color': STATUS_CONFIG[statusKey].color,
    '--i': Math.min(index, 16),
    viewTransitionName: `obra-${obra.id.replace(/[^a-zA-Z0-9_-]/g, '')}`,
  } as CSSProperties;

  const cover = (
    <>
      <Cover src={obra.capa} title={obra.titulo} eager={index < 6} />
      <span className={styles.status}>
        <span className={styles.dot} aria-hidden="true" />
        {statusLabel}
      </span>
    </>
  );

  return (
    <article className={cx(styles.card, readOnly && styles.readOnly)} style={style}>
      {readOnly || !onEdit ? (
        <div className={styles.coverWrap}>{cover}</div>
      ) : (
        <button
          type="button"
          className={cx(styles.coverWrap, styles.coverBtn)}
          onClick={() => onEdit(obra as Obra)}
          aria-label={t('card_edit', { titulo: obra.titulo })}
        >
          {cover}
        </button>
      )}

      <div className={styles.meta}>
        <h3 className={styles.title} title={obra.titulo}>
          {obra.titulo}
        </h3>
        <p className={styles.sub}>
          {tipoLabel}
          {obra.site && (
            <>
              <span className={styles.sep} aria-hidden="true">
                ·
              </span>
              {obra.site}
            </>
          )}
        </p>

        {readOnly ? (
          <p className={styles.capStatic}>
            <span className={styles.capLabel}>{t('cap_short')}</span> {obra.capituloAtual}
          </p>
        ) : (
          <div className={styles.capRow}>
            <button
              type="button"
              className={styles.step}
              onClick={() => step(-1)}
              disabled={!canStepDown}
              aria-label={t('card_prev')}
              title={t('card_prev')}
            >
              <Minus />
            </button>

            {editing ? (
              <input
                ref={inputRef}
                className={styles.capInput}
                value={capInput}
                inputMode="decimal"
                onChange={(e) => setCapInput(e.target.value)}
                onBlur={commitCap}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCap();
                  if (e.key === 'Escape') {
                    setCapInput(obra.capituloAtual);
                    setEditing(false);
                  }
                }}
                aria-label={t('card_chapter_aria', { titulo: obra.titulo })}
              />
            ) : (
              <button
                type="button"
                className={cx(styles.capValue, bump && styles.bump)}
                onClick={() => setEditing(true)}
                onAnimationEnd={() => setBump(false)}
                title={t('card_edit_chapter')}
                aria-label={`${t('card_chapter_aria', { titulo: obra.titulo })}: ${obra.capituloAtual}. ${t('card_edit_chapter')}`}
              >
                <span className={styles.capLabel}>{t('cap_short')}</span>
                <span className={styles.capNum}>{obra.capituloAtual}</span>
              </button>
            )}

            <button
              type="button"
              className={cx(styles.step, styles.stepNext)}
              onClick={() => step(1)}
              aria-label={t('card_next')}
              title={t('card_next')}
            >
              <Plus />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(ObraCard);
