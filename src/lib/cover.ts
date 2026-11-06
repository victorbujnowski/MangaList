/**
 * Capas automáticas.
 *
 * Por que não MangaDex: as imagens de uploads.mangadex.org são bloqueadas
 * fora do site deles (placeholder "read this at MangaDex" ou verificação
 * anti-bot). A API deles só é usada para descobrir o ID da obra no AniList.
 *
 * Cadeia (para no primeiro acerto):
 *  1. Página da obra no site de leitura, via nosso Worker (/cover): a mesma
 *     capa que o site mostra. Hoje: Kitsune Yako.
 *  2. Link do MangaDex → ID no AniList (campo links.al) → capa exata.
 *  3. Busca no AniList pelo título (original, título do site, tradução PT→EN
 *     e palavras-chave), aceitando só resultados parecidos com o título
 *     (evita capa errada).
 *
 * AniList: API GraphQL pública, com CORS e imagens que podem ser exibidas.
 */

const ANILIST = 'https://graphql.anilist.co';

/** Base do Worker (VITE_COVER_PROXY = "https://<worker>/?url="). Sem ele, pula os passos 1 e 2. */
const PROXY_URL = import.meta.env.VITE_COVER_PROXY || '';
const WORKER_ORIGIN = (() => {
  try {
    return PROXY_URL ? new URL(PROXY_URL).origin : null;
  } catch {
    return null;
  }
})();

/** Similaridade mínima para aceitar um resultado automaticamente. */
const MATCH_THRESHOLD = 0.6;

export interface CoverResult {
  url: string;
  /** Título oficial encontrado (site ou AniList), quando houver. */
  title: string | null;
  source: 'site' | 'anilist';
}

export interface MangaSearchResult {
  id: string;
  title: string | null;
  year: number | null;
  coverUrl: string;
}

interface AlMedia {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[] | null;
  startDate: { year: number | null } | null;
  coverImage: { extraLarge: string | null; large: string | null } | null;
}

const MEDIA_FIELDS = `id title{romaji english native} synonyms startDate{year} coverImage{extraLarge large}`;

/* ── Normalização e semelhança de títulos (puro, testado) ─────────── */

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma',
  'the', 'of', 'an', 'and', 'in', 'on', 'to', 'for', 'is', 'at', 'by', 'with',
]);

/** Minúsculas, sem acento, só letras/números separados por espaço. */
export function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function toKeywords(text: string): string[] {
  return normalizeTitle(text)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w));
}

/**
 * Semelhança 0–1 entre dois títulos: 1 quando iguais normalizados, 0.9 quando
 * um contém o outro inteiro, senão coeficiente de Dice sobre as palavras.
 * Palavras curtas ("no", "8") contam: diferenciam "Kaiju No 8" de "Kaiju".
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length >= 4 && nb.length >= 4 && (` ${na} `.includes(` ${nb} `) || ` ${nb} `.includes(` ${na} `))) {
    return 0.9;
  }
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let common = 0;
  for (const w of ta) if (tb.has(w)) common++;
  return (2 * common) / (ta.size + tb.size);
}

function mediaTitles(m: AlMedia): string[] {
  return [m.title.english, m.title.romaji, m.title.native, ...(m.synonyms ?? [])].filter(
    (t): t is string => Boolean(t)
  );
}

/** Melhor resultado para a consulta, ou null se nenhum for parecido o bastante. */
export function bestMatch<T extends AlMedia>(query: string, media: T[]): { media: T; score: number } | null {
  let best: { media: T; score: number } | null = null;
  media.forEach((m, i) => {
    const score = Math.max(0, ...mediaTitles(m).map((t) => titleSimilarity(query, t))) - i * 0.01; // empate: ordem do AniList
    if (m.coverImage?.extraLarge || m.coverImage?.large) {
      if (!best || score > best.score) best = { media: m, score };
    }
  });
  const found = best as { media: T; score: number } | null;
  return found && found.score >= MATCH_THRESHOLD ? found : null;
}

/**
 * Consultas alternativas quando o título original não acha nada: tradução,
 * palavras-chave da tradução aparando da frente e palavras-chave do original.
 */
export function fallbackQueries(original: string, translated: string | null): string[] {
  const out: string[] = [];
  if (translated && normalizeTitle(translated) !== normalizeTitle(original)) {
    out.push(translated);
    // Aparar da frente, mas nunca abaixo de 3 palavras: "level hero" sozinho
    // casaria com qualquer obra parecida e traria a capa errada.
    const kw = toKeywords(translated);
    for (let i = 1; kw.length - i >= 3; i++) out.push(kw.slice(i).join(' '));
  }
  const kwPt = toKeywords(original);
  if (kwPt.length > 1 && kwPt.join(' ') !== normalizeTitle(original)) out.push(kwPt.join(' '));
  return [...new Set(out.filter((c) => c.trim()))];
}

/* ── Chamadas de rede ─────────────────────────────────────────────── */

async function anilist<T>(query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal,
    });
    if (!res.ok) return null; // 429 (limite) ou fora do ar: falha em silêncio
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
}

async function searchAniList(search: string, perPage: number, signal?: AbortSignal): Promise<AlMedia[]> {
  const data = await anilist<{ Page: { media: AlMedia[] } }>(
    `query($s:String,$n:Int){Page(perPage:$n){media(search:$s,type:MANGA,sort:SEARCH_MATCH){${MEDIA_FIELDS}}}}`,
    { s: search, n: perPage },
    signal
  );
  return data?.Page.media ?? [];
}

async function aniListById(id: number, signal?: AbortSignal): Promise<AlMedia | null> {
  const data = await anilist<{ Media: AlMedia | null }>(
    `query($id:Int){Media(id:$id,type:MANGA){${MEDIA_FIELDS}}}`,
    { id },
    signal
  );
  return data?.Media ?? null;
}

function coverOf(m: AlMedia): string | null {
  return m.coverImage?.extraLarge || m.coverImage?.large || null;
}

function displayTitle(m: AlMedia): string | null {
  return m.title.english || m.title.romaji || m.title.native;
}

/** Traduz PT→EN via MyMemory (grátis, com CORS). Falha em silêncio. */
async function translateToEnglish(text: string, signal?: AbortSignal): Promise<string | null> {
  if (!text.trim()) return null;
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=pt|en`,
      { signal }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { responseData?: { translatedText?: string } };
    return json.responseData?.translatedText?.trim() || null;
  } catch {
    return null;
  }
}

/** Passo 1: capa e título oficiais lidos da página da obra, pelo Worker. */
async function coverFromSite(pageUrl: string, signal?: AbortSignal): Promise<{ image: string | null; title: string | null } | null> {
  if (!WORKER_ORIGIN) return null;
  try {
    const res = await fetch(`${WORKER_ORIGIN}/cover?page=${encodeURIComponent(pageUrl)}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as { image: string | null; title: string | null };
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
}

/** Passo 2: ID do MangaDex → ID do AniList (links.al), pelo Worker. */
async function aniListIdFromMangaDex(mangaId: string, signal?: AbortSignal): Promise<number | null> {
  if (!PROXY_URL) return null;
  try {
    const res = await fetch(PROXY_URL + encodeURIComponent(`https://api.mangadex.org/manga/${mangaId}`), { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { attributes?: { links?: Record<string, string> | null } } };
    const al = Number(json.data?.attributes?.links?.al);
    return Number.isInteger(al) && al > 0 ? al : null;
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
}

interface MdSearchManga {
  attributes?: {
    title?: Record<string, string>;
    altTitles?: Array<Record<string, string>>;
    links?: Record<string, string> | null;
  };
}

/**
 * Todos os nomes de uma obra no MangaDex (título + alternativos em qualquer
 * idioma). Os alternativos em pt-br, cadastrados pela comunidade de scans,
 * são o que permite casar "Mago do Infinito" com "The Infinite Mage".
 */
export function mangaDexNames(m: MdSearchManga): string[] {
  const a = m.attributes ?? {};
  return [...Object.values(a.title ?? {}), ...(a.altTitles ?? []).flatMap((t) => Object.values(t))];
}

/**
 * Nome em português (ou qualquer idioma) → ID no AniList, pelos títulos
 * alternativos do MangaDex. Só aceita obra com nome parecido o bastante.
 */
async function aniListIdFromMangaDexTitle(title: string, signal?: AbortSignal): Promise<number | null> {
  if (!PROXY_URL) return null;
  const params = new URLSearchParams({ title, limit: '5' });
  params.append('order[relevance]', 'desc');
  for (const r of ['safe', 'suggestive', 'erotica']) params.append('contentRating[]', r);
  try {
    const res = await fetch(PROXY_URL + encodeURIComponent(`https://api.mangadex.org/manga?${params}`), { signal });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data?: MdSearchManga[] };
    let best: { al: number; score: number } | null = null;
    for (const m of data ?? []) {
      const al = Number(m.attributes?.links?.al);
      if (!Number.isInteger(al) || al <= 0) continue;
      const score = Math.max(0, ...mangaDexNames(m).map((n) => titleSimilarity(title, n)));
      if (!best || score > best.score) best = { al, score };
    }
    return best && best.score >= MATCH_THRESHOLD ? best.al : null;
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
}

async function coverByMangaDexTitle(title: string, signal?: AbortSignal): Promise<CoverResult | null> {
  const alId = await aniListIdFromMangaDexTitle(title, signal);
  const media = alId ? await aniListById(alId, signal) : null;
  const url = media && coverOf(media);
  return media && url ? { url, title: displayTitle(media), source: 'anilist' } : null;
}

/**
 * Passo 3: busca por título, aceitando só resultados parecidos.
 * Ordem: AniList direto (nomes em inglês/romaji) → nomes alternativos do
 * MangaDex (nomes em português) → tradução PT→EN e palavras-chave.
 */
async function coverByTitle(titles: string[], signal?: AbortSignal): Promise<CoverResult | null> {
  const tried = new Set<string>();
  const attempt = async (q: string, ref: string): Promise<CoverResult | null> => {
    const key = normalizeTitle(q);
    if (!key || tried.has(key)) return null;
    tried.add(key);
    const hit = bestMatch(ref, await searchAniList(q, 8, signal));
    const url = hit && coverOf(hit.media);
    return hit && url ? { url, title: displayTitle(hit.media), source: 'anilist' } : null;
  };

  for (const t of titles) {
    const direct = await attempt(t, t);
    if (direct) return direct;
  }
  for (const t of titles) {
    const viaAlt = await coverByMangaDexTitle(t, signal);
    if (viaAlt) return viaAlt;
  }
  // Títulos traduzidos para o PT (comum em manhwa): tenta o nome em inglês.
  const main = titles[0];
  if (!main) return null;
  const en = await translateToEnglish(main, signal);
  for (const q of fallbackQueries(main, en)) {
    // Compara com a própria consulta: o resultado tem que parecer com ela.
    const hit = await attempt(q, q);
    if (hit) return hit;
  }
  return null;
}

/* ── API pública ──────────────────────────────────────────────────── */

export interface FindCoverInput {
  /** URL colada pelo usuário (capítulo ou série). */
  pageUrl?: string | null;
  siteKey?: string | null;
  title?: string | null;
  /** UUID da obra no MangaDex (links /title/<uuid>). */
  mangaId?: string | null;
  signal?: AbortSignal;
}

/** Sites cuja página da obra o Worker sabe ler. */
const SCRAPABLE_SITES = new Set(['kitsune']);

/**
 * Página da série no Kitsune a partir do título (para obras salvas sem link):
 * o WordPress gera o slug sem acentos, minúsculo e com hífens.
 */
export function kitsuneSeriesUrlFromTitle(title: string): string | null {
  const slug = normalizeTitle(title).replace(/ /g, '-');
  return slug ? `https://kitsuneyako.com/manga/${slug}/` : null;
}

/** Melhor capa para a obra (ver a cadeia no topo do arquivo). Nunca lança, salvo abort. */
export async function findCover({ pageUrl, siteKey, title, mangaId, signal }: FindCoverInput): Promise<CoverResult | null> {
  let siteTitle: string | null = null;

  const sitePage =
    siteKey && SCRAPABLE_SITES.has(siteKey) ? pageUrl || (title ? kitsuneSeriesUrlFromTitle(title) : null) : null;
  if (sitePage) {
    const site = await coverFromSite(sitePage, signal);
    siteTitle = site?.title ?? null;
    if (site?.image) return { url: site.image, title: siteTitle, source: 'site' };
  }

  if (mangaId) {
    const alId = await aniListIdFromMangaDex(mangaId, signal);
    const media = alId ? await aniListById(alId, signal) : null;
    const url = media && coverOf(media);
    if (media && url) return { url, title: displayTitle(media), source: 'anilist' };
  }

  const titles = [title, siteTitle].filter((t): t is string => Boolean(t?.trim()));
  return titles.length ? coverByTitle(titles, signal) : null;
}

/**
 * Busca manual (seletor de capa): lista resultados do AniList. Se o termo não
 * achar nada, tenta a tradução e as palavras-chave.
 */
export async function searchCovers(
  query: string,
  { limit = 12, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<{ results: MangaSearchResult[]; usedQuery: string }> {
  const q = query.trim();
  if (!q) return { results: [], usedQuery: '' };
  const toResults = (media: AlMedia[]) =>
    media.flatMap((m) => {
      const coverUrl = coverOf(m);
      return coverUrl ? [{ id: String(m.id), title: displayTitle(m), year: m.startDate?.year ?? null, coverUrl }] : [];
    });

  // Em paralelo: busca direta no AniList e a tradução do nome pelo MangaDex.
  const [direct, alId] = await Promise.all([
    searchAniList(q, limit, signal),
    aniListIdFromMangaDexTitle(q, signal),
  ]);
  let results = toResults(direct);
  if (alId && !direct.some((m) => m.id === alId)) {
    // Nome em português reconhecido: a obra certa vai para o topo da lista.
    const media = await aniListById(alId, signal);
    if (media) results = [...toResults([media]), ...results];
  } else if (alId) {
    results.sort((a, b) => Number(b.id === String(alId)) - Number(a.id === String(alId)));
  }
  if (results.length) return { results, usedQuery: q };

  const en = await translateToEnglish(q, signal);
  for (const c of fallbackQueries(q, en)) {
    results = toResults(await searchAniList(c, limit, signal));
    if (results.length) return { results, usedQuery: c };
  }
  return { results: [], usedQuery: q };
}

/**
 * Capas populares (fundo da tela de login). Só conteúdo não adulto, 230px.
 * Falha em silêncio (lista vazia).
 */
export async function fetchPopularCovers(limit = 24): Promise<string[]> {
  const data = await anilist<{ Page: { media: Array<{ coverImage: { large: string | null } | null }> } }>(
    `query($n:Int){Page(perPage:$n){media(type:MANGA,sort:POPULARITY_DESC,isAdult:false){coverImage{large}}}}`,
    { n: limit }
  );
  return (data?.Page.media ?? []).map((m) => m.coverImage?.large).filter((u): u is string => Boolean(u));
}

/**
 * Capas salvas que não aparecem mais (MangaDex bloqueia exibição externa).
 * Obras com capa assim, ou sem capa, entram na recuperação automática.
 */
export function isBrokenCoverUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  try {
    return new URL(url).hostname === 'uploads.mangadex.org';
  } catch {
    return true;
  }
}
