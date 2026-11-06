import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Check, ExternalLink, ImageOff, Search, Trash2, TriangleAlert } from 'lucide-react';
import { parseUrl, SITES, SITE_KEYS } from '../lib/urlParser';
import { findCover, searchCovers, type MangaSearchResult } from '../lib/cover';
import { STATUS_KEYS, TIPO_KEYS } from '../lib/constants';
import { useI18n } from '../i18n/I18nContext';
import type { Obra, ObraDraft, StatusKey, TipoKey } from '../types';
import { Dialog } from './ui/Dialog';
import { Button, cx } from './ui/Button';
import { Field, Input, Select, Textarea } from './ui/Field';
import { Cover } from './ui/Cover';
import styles from './ObraModal.module.css';

const EMPTY_FORM: ObraDraft = {
  titulo: '',
  tipo: 'manga',
  site: SITES.sakura.name,
  siteKey: 'sakura',
  capituloAtual: '1',
  status: 'lendo',
  nota: '',
  generos: [],
  capa: '',
  notasLivres: '',
  urlOrigem: '',
};

type CoverStatus = 'idle' | 'loading' | 'found' | 'notfound';

interface ObraModalProps {
  open: boolean;
  obra: Obra | null;
  initialUrl?: string;
  onSave: (draft: ObraDraft) => Promise<void>;
  onDelete: (obra: Obra) => Promise<void>;
  onClose: () => void;
}

/** Só links http(s) viram âncora: nada de javascript: vindo de dados salvos. */
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export default function ObraModal({ open, obra, initialUrl = '', onSave, onDelete, onClose }: ObraModalProps) {
  const { t } = useI18n();
  const formId = useId();
  const isEdit = Boolean(obra?.id);

  const [form, setForm] = useState<ObraDraft>(() =>
    obra ? { ...EMPTY_FORM, ...obra, nota: obra.nota ?? '', capa: obra.capa ?? '' } : EMPTY_FORM
  );
  const [genresText, setGenresText] = useState(() => (obra?.generos ?? []).join(', '));
  const [url, setUrl] = useState(initialUrl);
  const [parseInfo, setParseInfo] = useState<{ site: string; title: string | null; chapter: string | null; manual: boolean } | null>(null);
  const [parseError, setParseError] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Capa
  const [coverStatus, setCoverStatus] = useState<CoverStatus>('idle');
  const [coverMatch, setCoverMatch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [coverQuery, setCoverQuery] = useState('');
  const [results, setResults] = useState<MangaSearchResult[]>([]);
  const [usedQuery, setUsedQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState('');
  const coverReq = useRef(0);
  const searchAbort = useRef<AbortController | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLElement>(null);

  const set = useCallback(<K extends keyof ObraDraft>(key: K, value: ObraDraft[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  useEffect(() => () => searchAbort.current?.abort(), []);

  // O seletor abre no fim do formulário: rola até ele.
  useEffect(() => {
    if (pickerOpen) pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [pickerOpen]);

  // Busca automática da melhor capa (ao extrair a URL). Ignora respostas velhas.
  const autoCover = useCallback(
    async (input: { pageUrl: string; siteKey: string; title: string | null; mangaId: string | null }) => {
      if (!input.title?.trim() && !input.mangaId && !input.pageUrl) return;
      const req = ++coverReq.current;
      setCoverStatus('loading');
      const result = await findCover(input);
      if (req !== coverReq.current) return;
      if (result) {
        setForm((f) => ({
          ...f,
          capa: result.url,
          // O site devolve o título com a grafia oficial (acentos, pontuação):
          // troca o título tirado da URL, se o usuário ainda não mexeu nele.
          titulo: result.source === 'site' && result.title && f.titulo === input.title ? result.title : f.titulo,
        }));
        setCoverMatch(result.title ?? '');
        setCoverStatus('found');
      } else {
        setCoverStatus('notfound');
      }
    },
    []
  );

  const runSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;
    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setSearching(true);
    setResults([]);
    try {
      const { results: found, usedQuery: used } = await searchCovers(q, { signal: ctrl.signal });
      setResults(found);
      setUsedQuery(used);
      setSearched(q);
    } catch {
      /* abortada: outra busca assumiu */
    } finally {
      if (searchAbort.current === ctrl) setSearching(false);
    }
  }, []);

  const applyParse = useCallback(
    (raw: string) => {
      const result = parseUrl(raw);
      if (!result.success) {
        setParseError(t(result.errorKey, result.errorParams));
        setParseInfo(null);
        return;
      }
      setParseError('');
      setParseInfo({ site: result.site, title: result.title, chapter: result.chapter, manual: result.needsManualTitle });
      setForm((f) => ({
        ...f,
        titulo: result.title || f.titulo,
        tipo: result.type,
        site: result.site,
        siteKey: result.siteKey,
        capituloAtual: result.chapter || f.capituloAtual,
        urlOrigem: raw.trim(),
      }));
      setTitleError(false);
      if (result.needsManualTitle) window.setTimeout(() => titleRef.current?.focus(), 0);
      void autoCover({ pageUrl: raw.trim(), siteKey: result.siteKey, title: result.title, mangaId: result.mangaId });
    },
    [autoCover, t]
  );

  // URL vinda do compartilhamento: já tenta extrair ao abrir.
  useEffect(() => {
    if (initialUrl && !isEdit) applyParse(initialUrl);
    // Só na montagem: o App troca a chave do componente a cada abertura.
  }, []);

  function openPicker() {
    const q = form.titulo.trim();
    setCoverQuery(q);
    setPickerOpen(true);
    setResults([]);
    setSearched('');
    if (q) void runSearch(q);
  }

  function pickCover(r: MangaSearchResult) {
    coverReq.current++; // cancela uma busca automática em andamento
    set('capa', r.coverUrl);
    setCoverMatch(r.title ?? '');
    setCoverStatus('found');
    setPickerOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    const generos = genresText.split(',').map((g) => g.trim()).filter(Boolean);
    setSaving(true);
    try {
      await onSave({ ...form, generos, id: obra?.id });
      onClose();
    } catch {
      // O App já avisou com um toast; o formulário continua aberto e intacto.
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!obra) return;
    setDeleting(true);
    try {
      await onDelete(obra);
      onClose();
    } catch {
      setDeleting(false);
    }
  }

  const sourceHref = isEdit ? safeHttpUrl(form.urlOrigem) : null;
  const busy = saving || deleting;

  const footer = confirmDelete ? (
    <div className={styles.confirm} role="alertdialog" aria-labelledby={`${formId}-del`}>
      <div className={styles.confirmText}>
        <p id={`${formId}-del`} className={styles.confirmTitle}>
          {t('delete_confirm_q', { titulo: form.titulo || obra?.titulo || '' })}
        </p>
        <p className={styles.confirmBody}>{t('delete_confirm_body')}</p>
      </div>
      <div className={styles.footActions}>
        <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
          {t('cancel')}
        </Button>
        <Button variant="danger" onClick={handleDelete} loading={deleting} icon={<Trash2 />} autoFocus>
          {t('delete_confirm_yes')}
        </Button>
      </div>
    </div>
  ) : (
    <>
      {isEdit && (
        <Button variant="ghost" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} icon={<Trash2 />} disabled={busy}>
          {t('delete_obra')}
        </Button>
      )}
      <div className={styles.footActions}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {t('cancel')}
        </Button>
        <Button variant="primary" type="submit" form={formId} loading={saving}>
          {isEdit ? t('save_changes') : t('add_obra')}
        </Button>
      </div>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? form.titulo || t('modal_edit_title') : t('modal_add_title')}
      eyebrow={isEdit ? t('modal_edit_title') : undefined}
      size="lg"
      footer={footer}
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className={styles.form}>
        {!isEdit && (
          <section className={styles.parser}>
            <Field label={t('paste_url_label')} hint={parseInfo ? undefined : t('paste_url_hint')} error={parseError || undefined}>
              {({ id, describedBy, invalid }) => (
                <div className={styles.parserRow}>
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    autoFocus={!initialUrl}
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setParseError('');
                    }}
                    onPaste={(e) => {
                      // Colou uma URL inteira: extrai na hora, sem precisar clicar.
                      const pasted = e.clipboardData.getData('text').trim();
                      if (/^https?:\/\//i.test(pasted)) {
                        e.preventDefault();
                        setUrl(pasted);
                        applyParse(pasted);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyParse(url);
                      }
                    }}
                    placeholder={t('url_placeholder')}
                  />
                  <Button variant="secondary" onClick={() => applyParse(url)} disabled={!url.trim()}>
                    {t('extract')}
                  </Button>
                </div>
              )}
            </Field>

            {parseInfo && (
              <p className={cx(styles.parseOk, parseInfo.manual && styles.parseWarn)} role="status">
                {parseInfo.manual ? <TriangleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}
                <span>
                  {t('parse_ok', { site: parseInfo.site })}
                  {parseInfo.chapter && (
                    <>
                      {' · '}
                      <span className={styles.mono}>
                        {t('cap_short')} {parseInfo.chapter}
                      </span>
                    </>
                  )}
                  {parseInfo.manual && <> · {t('manual_title_warn')}</>}
                </span>
              </p>
            )}

            <div className={styles.rule}>
              <span>{t('or_fill_manually')}</span>
            </div>
          </section>
        )}

        <div className={styles.layout}>
          {/* Coluna da capa */}
          <div className={styles.coverCol}>
            <div className={styles.coverFrame}>
              <Cover src={form.capa} title={form.titulo} eager />
              {coverStatus === 'loading' && <span className={styles.coverLoading} aria-hidden="true" />}
            </div>
            <div className={styles.coverActions}>
              <Button variant="secondary" size="sm" block onClick={openPicker} icon={<Search />} loading={coverStatus === 'loading'}>
                {coverStatus === 'loading' ? t('cover_searching') : t('cover_search_md')}
              </Button>
              {form.capa && (
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  icon={<ImageOff />}
                  onClick={() => {
                    coverReq.current++;
                    set('capa', '');
                    setCoverStatus('idle');
                  }}
                >
                  {t('cover_remove')}
                </Button>
              )}
            </div>
            <p className={styles.coverNote} aria-live="polite">
              {coverStatus === 'found' && coverMatch && t('cover_found', { name: coverMatch })}
              {coverStatus === 'notfound' && t('cover_notfound')}
            </p>
          </div>

          {/* Campos */}
          <div className={styles.fields}>
            <Field label={t('field_title')} error={titleError ? t('title_required') : undefined}>
              {({ id, describedBy, invalid }) => (
                <Input
                  ref={titleRef}
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  required
                  value={form.titulo}
                  onChange={(e) => {
                    set('titulo', e.target.value);
                    if (e.target.value.trim()) setTitleError(false);
                  }}
                  placeholder={t('title_placeholder')}
                  className={styles.titleInput}
                />
              )}
            </Field>

            <div className={styles.grid2}>
              <Field label={t('field_type')}>
                {({ id }) => (
                  <Select id={id} value={form.tipo} onChange={(e) => set('tipo', e.target.value as TipoKey)}>
                    {TIPO_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {t(`tipo.${k}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('field_site')}>
                {({ id }) => (
                  <Select
                    id={id}
                    value={form.siteKey}
                    onChange={(e) => {
                      const key = e.target.value as keyof typeof SITES;
                      setForm((f) => ({ ...f, siteKey: key, site: SITES[key]?.name ?? key }));
                    }}
                  >
                    {/* Obra antiga com site fora da lista: mantém a opção visível. */}
                    {!SITE_KEYS.includes(form.siteKey as keyof typeof SITES) && form.siteKey && (
                      <option value={form.siteKey}>{form.site || form.siteKey}</option>
                    )}
                    {SITE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {SITES[key].name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <div className={styles.grid3}>
              <Field label={t('field_chapter')}>
                {({ id }) => (
                  <Input
                    id={id}
                    inputMode="decimal"
                    className={styles.mono}
                    value={form.capituloAtual}
                    onChange={(e) => set('capituloAtual', e.target.value)}
                    placeholder="1"
                  />
                )}
              </Field>
              <Field label={t('field_status')}>
                {({ id }) => (
                  <Select id={id} value={form.status} onChange={(e) => set('status', e.target.value as StatusKey)}>
                    {STATUS_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {t(`status.${k}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('field_rating')}>
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={10}
                    step={0.5}
                    className={styles.mono}
                    value={form.nota ?? ''}
                    onChange={(e) => set('nota', e.target.value)}
                    placeholder={t('rating_hint')}
                    aria-label={`${t('field_rating')} (${t('rating_hint')})`}
                  />
                )}
              </Field>
            </div>

            <Field label={t('field_genres')} hint={t('genres_hint')}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={genresText}
                  onChange={(e) => setGenresText(e.target.value)}
                  placeholder={t('genres_placeholder')}
                />
              )}
            </Field>

            <Field label={t('field_notes')}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={form.notasLivres}
                  onChange={(e) => set('notasLivres', e.target.value)}
                  placeholder={t('notes_placeholder')}
                />
              )}
            </Field>

            <Field label={t('field_cover')}>
              {({ id }) => (
                <Input
                  id={id}
                  type="url"
                  inputMode="url"
                  value={form.capa ?? ''}
                  onChange={(e) => {
                    coverReq.current++;
                    set('capa', e.target.value);
                    setCoverStatus('idle');
                  }}
                  placeholder={t('cover_input_placeholder')}
                />
              )}
            </Field>

            {sourceHref && (
              <a className={styles.source} href={sourceHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                {t('source_link')}
              </a>
            )}
          </div>
        </div>

        {pickerOpen && (
          <section ref={pickerRef} className={styles.picker} aria-label={t('cover_search_md')}>
            <div className={styles.parserRow}>
              <Input
                value={coverQuery}
                autoFocus
                onChange={(e) => setCoverQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runSearch(coverQuery);
                  }
                }}
                placeholder={t('cover_query_placeholder')}
                aria-label={t('cover_query_placeholder')}
              />
              <Button variant="primary" onClick={() => void runSearch(coverQuery)} disabled={!coverQuery.trim()} loading={searching} icon={<Search />}>
                {t('search_btn')}
              </Button>
            </div>

            {!searching && results.length > 0 && usedQuery && usedQuery.toLowerCase() !== searched.toLowerCase() && (
              <p className={styles.pickerNote}>{t('cover_no_orig', { q: usedQuery })}</p>
            )}
            {!searching && searched && results.length === 0 && (
              <p className={styles.pickerNote}>{t('cover_none_for', { q: searched })}</p>
            )}

            {(searching || results.length > 0) && (
              <ul className={styles.results} aria-busy={searching}>
                {searching
                  ? Array.from({ length: 6 }, (_, i) => <li key={i} className={styles.resultSkeleton} />)
                  : results.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className={cx(styles.result, form.capa === r.coverUrl && styles.resultActive)}
                          onClick={() => pickCover(r)}
                          aria-label={`${t('cover_pick')}: ${r.title ?? ''}`}
                        >
                          <Cover src={r.coverUrl} title={r.title ?? ''} />
                          <span className={styles.resultTitle}>{r.title}</span>
                          {r.year && <span className={styles.resultYear}>{r.year}</span>}
                        </button>
                      </li>
                    ))}
              </ul>
            )}

            <Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
              {t('close_search')}
            </Button>
          </section>
        )}
      </form>
    </Dialog>
  );
}
