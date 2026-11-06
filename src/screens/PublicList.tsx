import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { getPublicList } from '../lib/share';
import { STATUS_CONFIG, STATUS_KEYS } from '../lib/constants';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../hooks/useTheme';
import type { PublicListDoc } from '../types';
import ObraCard from '../components/ObraCard';
import { Loader } from '../components/ui/Loader';
import EmptyState from '../components/EmptyState';
import { StatusTabs, type FilterOption } from '../components/LibraryControls';
import { Wordmark } from '../components/Wordmark';
import styles from './PublicList.module.css';

type State = { status: 'loading' } | { status: 'ready'; data: PublicListDoc } | { status: 'missing' };

/**
 * Estante compartilhada, só leitura. Lê `publicLists/{token}` sem login
 * (regra `get` pública). É o que qualquer pessoa com o link vê.
 */
export default function PublicList({ token }: { token: string }) {
  const { t, locale } = useI18n();
  useTheme(); // aplica o tema salvo deste visitante
  const [state, setState] = useState<State>({ status: 'loading' });
  const [filter, setFilter] = useState('todos');

  useEffect(() => {
    let alive = true;
    getPublicList(token)
      .then((data) => alive && setState(data ? { status: 'ready', data } : { status: 'missing' }))
      .catch(() => alive && setState({ status: 'missing' }));
    return () => {
      alive = false;
    };
  }, [token]);

  const obras = state.status === 'ready' ? state.data.obras ?? [] : [];

  const items = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    for (const o of obras) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return [
      { key: 'todos', label: t('all'), count: obras.length },
      ...STATUS_KEYS.filter((k) => counts[k]).map((k) => ({
        key: k,
        label: t(`status.${k}`),
        color: STATUS_CONFIG[k].color,
        count: counts[k] ?? 0,
      })),
    ];
  }, [obras, t]);

  const visible = filter === 'todos' ? obras : obras.filter((o) => o.status === filter);

  const header = (
    <header className={styles.top}>
      <div className={styles.topInner}>
        <a href="/" aria-label="MangaList">
          <Wordmark />
        </a>
        <a className={styles.cta} href="/">
          {t('public_create_mine')}
          <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </header>
  );

  if (state.status === 'missing') {
    return (
      <div className={styles.page}>
        {header}
        <main className={styles.main}>
          <EmptyState
            title={t('public_notfound_title')}
            action={
              <a className={styles.ctaSolid} href="/">
                {t('public_create_mine')}
              </a>
            }
          >
            {t('public_notfound')}
          </EmptyState>
        </main>
      </div>
    );
  }

  const data = state.status === 'ready' ? state.data : null;
  const updated = (() => {
    const ts = data?.updatedAt as { toDate?: () => Date } | undefined;
    const d = ts?.toDate?.();
    return d ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d) : null;
  })();

  return (
    <div className={styles.page}>
      {header}
      <main className={styles.main}>
        <section className={styles.masthead}>
          <p className={styles.dateline}>{t('public_shared_via')}</p>
          {data ? (
            <h1 className={styles.title}>
              {data.ownerName ? t('public_list_of', { name: data.ownerName }) : t('public_list_anon')}
            </h1>
          ) : (
            <div className={styles.titleSkeleton} aria-label={t('public_loading')} />
          )}
          {data && (
            <p className={styles.summary}>
              <span>{obras.length === 1 ? t('count_one', { n: 1 }) : t('count_many', { n: obras.length })}</span>
              {updated && (
                <>
                  <span className={styles.summarySep} aria-hidden="true" />
                  <span>{t('public_updated', { date: updated })}</span>
                </>
              )}
            </p>
          )}
        </section>

        {data && obras.length > 0 && items.length > 2 && (
          <div className={styles.controls}>
            <StatusTabs items={items} active={filter} onChange={setFilter} label={t('filter_status')} />
          </div>
        )}

        {!data ? (
          <Loader label={t('public_loading')} />
        ) : obras.length === 0 ? (
          <EmptyState title={t('public_empty')} />
        ) : (
          <div className={styles.grid}>
            {visible.map((o, i) => (
              <ObraCard key={o.id || i} obra={o} readOnly index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
