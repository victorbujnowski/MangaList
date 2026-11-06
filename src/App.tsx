import { useState, useMemo, useEffect, useCallback, useRef, useId } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { useObras } from './hooks/useObras';
import { useShareTarget } from './hooks/useShareTarget';
import { useHashView } from './hooks/useHashView';
import { useCoverBackfill } from './hooks/useCoverBackfill';
import { useI18n } from './i18n/I18nContext';
import { STATUS_CONFIG, STATUS_KEYS, TIPO_KEYS } from './lib/constants';
import { SITES, SITE_KEYS } from './lib/urlParser';
import { getShareToken, enableShare, disableShare, syncShare, ShareTooLargeError } from './lib/share';
import type { Obra, ObraDraft } from './types';
import Header from './components/Header';
import { StatusTabs, SearchField, FiltersButton, ChipGroup, type FilterOption } from './components/LibraryControls';
import ObraCard from './components/ObraCard';
import ObraCardSkeleton from './components/ObraCardSkeleton';
import ObraModal from './components/ObraModal';
import EmptyState from './components/EmptyState';
import Login from './components/Login';
import PublicList from './components/PublicList';
import UserArea from './components/UserArea';
import { Wordmark } from './components/Wordmark';
import { Button } from './components/ui/Button';
import { useToast } from './components/ui/Toast';
import styles from './App.module.css';

/** Rota da lista pública: /lista/{token} */
function getSharePath(): string | null {
  const m = window.location.pathname.match(/^\/lista\/([^/]+)\/?$/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/** Minúsculas e sem acentos: "Kimetsu" acha "kimetsu", "acao" acha "ação". */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface ModalState {
  open: boolean;
  obra: Obra | null;
  initialUrl: string;
  /** Muda a cada abertura: remonta o formulário com estado limpo. */
  key: number;
}

export default function App() {
  const sharePath = useMemo(getSharePath, []);
  // Lista pública: não precisa de auth, obras nem tema do dono.
  if (sharePath) return <PublicList token={sharePath} />;
  return <Shelf />;
}

function Shelf() {
  const { isDark, toggleTheme } = useTheme();
  const auth = useAuth();
  const { user, isLocal } = auth;
  const { obras, loading: obrasLoading, loadError, addObra, updateObra, updateCapitulo, updateCapa, deleteObra } =
    useObras(user?.uid);
  const { sharedUrl, clearShared } = useShareTarget();
  const { t, locale } = useI18n();
  const toast = useToast();
  const filterPanelId = useId();

  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterSite, setFilterSite] = useState('todos');
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ open: false, obra: null, initialUrl: '', key: 0 });

  const account = useHashView('conta');

  // Obras sem capa (ou com capa do MangaDex, que não aparece mais) ganham capa sozinhas.
  useCoverBackfill(obras, Boolean(user) && !obrasLoading && !loadError, updateCapa);

  // Compartilhamento por link
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const shareLink = shareToken ? `${window.location.origin}/lista/${shareToken}` : '';
  const warnedTooLarge = useRef(false);

  const openModal = useCallback((obra: Obra | null, initialUrl = '') => {
    setModal((m) => ({ open: true, obra, initialUrl, key: m.key + 1 }));
  }, []);
  const closeModal = useCallback(() => setModal((m) => ({ ...m, open: false })), []);

  // URL recebida pelo "Compartilhar" do celular → formulário já preenchido.
  useEffect(() => {
    if (sharedUrl && user) {
      openModal(null, sharedUrl);
      clearShared();
    }
  }, [sharedUrl, user, openModal, clearShared]);

  // Logout: fecha tudo (o App não desmonta entre sessões).
  useEffect(() => {
    if (!user) {
      account.close();
      setModal((m) => ({ ...m, open: false }));
      setShareToken(null);
    }
  }, [user, account.close]);

  // ── Filtros ──────────────────────────────────────────────
  const activeFilterCount = (filterTipo !== 'todos' ? 1 : 0) + (filterSite !== 'todos' ? 1 : 0);
  const isFiltering = activeFilterCount > 0 || filterStatus !== 'todos' || search.trim() !== '';

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return obras.filter(
      (o) =>
        (filterStatus === 'todos' || o.status === filterStatus) &&
        (filterTipo === 'todos' || (o.tipo || 'manga') === filterTipo) &&
        (filterSite === 'todos' || o.siteKey === filterSite) &&
        (!q || fold(o.titulo).includes(q))
    );
  }, [obras, filterStatus, filterTipo, filterSite, search]);

  const statusItems = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    for (const o of obras) counts[o.status] = (counts[o.status] ?? 0) + 1;
    return [
      { key: 'todos', label: t('all'), count: obras.length },
      ...STATUS_KEYS.map((k) => ({ key: k, label: t(`status.${k}`), color: STATUS_CONFIG[k].color, count: counts[k] ?? 0 })),
    ];
  }, [obras, t]);

  const tipoItems = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    for (const o of obras) counts[o.tipo || 'manga'] = (counts[o.tipo || 'manga'] ?? 0) + 1;
    return [
      { key: 'todos', label: t('all'), count: obras.length },
      ...TIPO_KEYS.map((k) => ({ key: k, label: t(`tipo.${k}`), count: counts[k] ?? 0 })),
    ];
  }, [obras, t]);

  const siteItems = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    for (const o of obras) if (o.siteKey) counts[o.siteKey] = (counts[o.siteKey] ?? 0) + 1;
    return [
      { key: 'todos', label: t('all'), count: obras.length },
      ...SITE_KEYS.map((k) => ({ key: k, label: SITES[k].name, count: counts[k] ?? 0 })),
    ];
  }, [obras, t]);

  const readingCount = statusItems.find((i) => i.key === 'lendo')?.count ?? 0;

  function clearFilters() {
    setFilterStatus('todos');
    setFilterTipo('todos');
    setFilterSite('todos');
    setSearch('');
  }

  // ── CRUD com aviso de erro ───────────────────────────────
  const handleSave = useCallback(
    async (draft: ObraDraft) => {
      try {
        if (draft.id) {
          await updateObra(draft.id, draft);
          toast.success(t('toast_saved'));
        } else {
          await addObra(draft);
          toast.success(t('toast_added', { titulo: draft.titulo.trim() }));
        }
      } catch (e) {
        console.error('[MangaList] Falha ao salvar obra:', e);
        toast.error(t('toast_save_error'));
        throw e; // o formulário fica aberto
      }
    },
    [updateObra, addObra, toast, t]
  );

  const handleDelete = useCallback(
    async (obra: Obra) => {
      try {
        await deleteObra(obra.id);
        toast.success(t('toast_deleted', { titulo: obra.titulo }));
      } catch (e) {
        console.error('[MangaList] Falha ao excluir obra:', e);
        toast.error(t('toast_delete_error'));
        throw e;
      }
    },
    [deleteObra, toast, t]
  );

  const handleCap = useCallback(
    (id: string, cap: string) => {
      updateCapitulo(id, cap).catch((e: unknown) => {
        console.error('[MangaList] Falha ao atualizar capítulo:', e);
        toast.error(t('toast_chapter_error'));
      });
    },
    [updateCapitulo, toast, t]
  );

  // ── Compartilhamento ─────────────────────────────────────
  useEffect(() => {
    if (isLocal || !user?.uid) return undefined;
    let alive = true;
    getShareToken(user.uid)
      .then((tok) => alive && setShareToken(tok))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user?.uid, isLocal]);

  // Mantém a cópia pública em dia (debounce). Só depois de carregar as obras,
  // para nunca sobrescrever a lista pública com uma lista vazia.
  const displayName = user?.displayName;
  useEffect(() => {
    if (isLocal || !shareToken || !user || obrasLoading || loadError) return undefined;
    const id = window.setTimeout(() => {
      syncShare(shareToken, user, obras).catch((e: unknown) => {
        if (e instanceof ShareTooLargeError) {
          if (!warnedTooLarge.current) toast.error(t('toast_share_too_large'));
          warnedTooLarge.current = true;
        }
      });
    }, 800);
    return () => window.clearTimeout(id);
    // displayName: o objeto User é mutado in-place ao trocar o apelido.
  }, [obras, shareToken, user, displayName, isLocal, obrasLoading, loadError, toast, t]);

  const handleEnableShare = useCallback(async () => {
    if (!user) return;
    setShareBusy(true);
    try {
      setShareToken(await enableShare(user, obras));
    } catch (e) {
      toast.error(e instanceof ShareTooLargeError ? t('toast_share_too_large') : t('toast_share_error'));
    } finally {
      setShareBusy(false);
    }
  }, [user, obras, toast, t]);

  const handleDisableShare = useCallback(async () => {
    if (!user || !shareToken) return;
    setShareBusy(true);
    try {
      await disableShare(user.uid, shareToken);
      setShareToken(null);
    } catch {
      toast.error(t('toast_share_error'));
    } finally {
      setShareBusy(false);
    }
  }, [user, shareToken, toast, t]);

  // ── Telas ────────────────────────────────────────────────
  if (auth.loading) {
    return (
      <div className={styles.splash} aria-busy="true">
        <Wordmark size="lg" />
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  if (!isLocal && !user) {
    return (
      <Login
        onGoogle={auth.loginGoogle}
        onEmailLogin={auth.loginEmail}
        onEmailRegister={auth.registerEmail}
        onResetPassword={auth.resetPassword}
        error={auth.error}
        clearError={auth.clearError}
      />
    );
  }

  if (account.isOpen && user) {
    return (
      <UserArea
        user={user}
        isLocal={isLocal}
        obrasCount={obras.length}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        sharing={Boolean(shareToken)}
        shareLink={shareLink}
        shareBusy={shareBusy}
        onEnableShare={handleEnableShare}
        onDisableShare={handleDisableShare}
        onUpdateName={auth.updateDisplayName}
        onChangePassword={auth.changePassword}
        onResetPassword={auth.resetPassword}
        onLogout={auth.logout}
        onClose={account.close}
      />
    );
  }

  const today = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className={styles.app}>
      <Header
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onAdd={() => openModal(null)}
        onOpenAccount={account.open}
        user={user}
        isLocal={isLocal}
      />

      <main className={styles.main}>
        <section className={styles.masthead}>
          <p className={styles.dateline}>{today}</p>
          <h1 className={styles.title}>{t('library_title')}</h1>
          {!obrasLoading && obras.length > 0 && (
            <p className={styles.summary}>
              <span>{obras.length === 1 ? t('count_one', { n: 1 }) : t('count_many', { n: obras.length })}</span>
              {readingCount > 0 && (
                <>
                  <span className={styles.summarySep} aria-hidden="true" />
                  <span>{t('library_reading', { n: readingCount })}</span>
                </>
              )}
            </p>
          )}
        </section>

        {obras.length > 0 && (
          <div className={styles.controls}>
            <StatusTabs items={statusItems} active={filterStatus} onChange={setFilterStatus} label={t('filter_status')} />
            <div className={styles.toolbar}>
              <SearchField value={search} onChange={setSearch} />
              <FiltersButton
                open={filterOpen}
                activeCount={activeFilterCount}
                onClick={() => setFilterOpen((v) => !v)}
                controls={filterPanelId}
              />
            </div>
            {filterOpen && (
              <div id={filterPanelId} className={styles.filterPanel}>
                <ChipGroup label={t('filter_type')} items={tipoItems} active={filterTipo} onChange={setFilterTipo} />
                <ChipGroup label={t('filter_site')} items={siteItems} active={filterSite} onChange={setFilterSite} />
              </div>
            )}
            {isFiltering && (
              <div className={styles.results} role="status">
                <span>
                  {filtered.length === 1 ? t('results_one', { n: 1 }) : t('results_many', { n: filtered.length })}
                </span>
                <button type="button" className={styles.clear} onClick={clearFilters}>
                  {t('filters_clear')}
                </button>
              </div>
            )}
          </div>
        )}

        {obrasLoading ? (
          <div className={styles.grid} aria-busy="true" aria-label={t('loading')}>
            {Array.from({ length: 12 }, (_, i) => (
              <ObraCardSkeleton key={i} index={i} />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState
            title={t('load_error')}
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                {t('retry')}
              </Button>
            }
          />
        ) : obras.length === 0 ? (
          <EmptyState
            title={t('empty_library_title')}
            action={
              <Button variant="primary" size="lg" icon={<Plus />} onClick={() => openModal(null)}>
                {t('empty_library_cta')}
              </Button>
            }
          >
            {t('empty_library_body')}
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t('empty_filtered_title')}
            action={
              <Button variant="secondary" onClick={clearFilters}>
                {t('filters_clear')}
              </Button>
            }
          >
            {t('empty_filtered_body')}
          </EmptyState>
        ) : (
          <div className={styles.grid}>
            {filtered.map((obra, index) => (
              <ObraCard key={obra.id} obra={obra} index={index} onEdit={openModal} onUpdateCap={handleCap} />
            ))}
          </div>
        )}
      </main>

      <ObraModal
        key={modal.key}
        open={modal.open}
        obra={modal.obra}
        initialUrl={modal.initialUrl}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={closeModal}
      />
    </div>
  );
}
