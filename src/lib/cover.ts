/**
 * Busca de capa via API pública do MangaDex.
 *
 * Mesmo para obras do Sakura/Kitsune pesquisamos o título no MangaDex: a
 * maioria das obras populares está catalogada lá. Com o UUID da obra (URLs
 * /title/uuid) buscamos por id, que é mais preciso.
 */

const API = 'https://api.mangadex.org';
const COVERS = 'https://uploads.mangadex.org/covers';
const ALL_RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'] as const;

// Em produção a API do MangaDex bloqueia CORS (só libera localhost). Quando a
// chamada direta falha, passamos a usar o proxy pelo resto da sessão.
// VITE_COVER_PROXY = seu Cloudflare Worker (ver cloudflare-worker/); sem ele,
// cai no allorigins público (lento e instável) como último recurso.
const CORS_PROXY = import.meta.env.VITE_COVER_PROXY || 'https://api.allorigins.win/raw?url=';
let useProxy = false;

interface MdRelationship {
  type: string;
  attributes?: { fileName?: string };
}

interface MdManga {
  id: string;
  attributes?: {
    title?: Record<string, string>;
    year?: number | null;
  };
  relationships?: MdRelationship[];
}

export interface CoverMatch {
  url: string;
  matchedTitle: string | null;
}

export interface MangaSearchResult {
  id: string;
  title: string | null;
  year: number | null;
  coverUrl: string;
}

async function mdFetch(url: string, signal?: AbortSignal): Promise<Response> {
  if (!useProxy) {
    try {
      return await fetch(url, { signal });
    } catch (e) {
      if (signal?.aborted) throw e;
      useProxy = true; // CORS bloqueado (produção) → proxy daqui pra frente
    }
  }
  // O proxy público é instável: tenta algumas vezes antes de desistir.
  let last: Response | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(CORS_PROXY + encodeURIComponent(url), { signal });
      if (res.ok) return res;
      last = res;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  if (last) return last;
  throw new Error('Proxy CORS indisponível');
}

/** Escolhe um título legível dentre os idiomas disponíveis. */
export function pickTitle(manga: MdManga | undefined): string | null {
  const t = manga?.attributes?.title ?? {};
  return t.en || t['ja-ro'] || t.ja || Object.values(t)[0] || null;
}

/** URL do thumbnail (512 ou 256px) a partir do cover_art incluído na resposta. */
export function buildCoverUrl(manga: MdManga, size: 256 | 512 = 512): string | null {
  const fileName = manga.relationships?.find((r) => r.type === 'cover_art')?.attributes?.fileName;
  return fileName ? `${COVERS}/${manga.id}/${fileName}.${size}.jpg` : null;
}

function searchParams(title: string, limit: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set('title', title);
  params.set('limit', String(limit));
  params.append('includes[]', 'cover_art');
  params.append('order[relevance]', 'desc');
  for (const r of ALL_RATINGS) params.append('contentRating[]', r);
  return params;
}

async function coverByMangaId(mangaId: string, signal?: AbortSignal): Promise<CoverMatch | null> {
  const res = await mdFetch(`${API}/manga/${mangaId}?includes[]=cover_art`, signal);
  if (!res.ok) return null;
  const { data } = (await res.json()) as { data?: MdManga };
  if (!data) return null;
  const url = buildCoverUrl(data);
  return url ? { url, matchedTitle: pickTitle(data) } : null;
}

async function searchOnce(query: string, limit: number, signal?: AbortSignal): Promise<MangaSearchResult[]> {
  const res = await mdFetch(`${API}/manga?${searchParams(query, limit).toString()}`, signal);
  if (!res.ok) return [];
  const { data } = (await res.json()) as { data?: MdManga[] };
  const out: MangaSearchResult[] = [];
  for (const m of data ?? []) {
    const coverUrl = buildCoverUrl(m);
    if (coverUrl) out.push({ id: m.id, title: pickTitle(m), year: m.attributes?.year ?? null, coverUrl });
  }
  return out;
}

/**
 * Palavras ignoradas ao reduzir um título a palavras-chave: artigos PT/EN e
 * adjetivos de "nível/classe" que costumam atrapalhar a busca.
 */
const STOPWORDS = new Set([
  // PT
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'que', 'com', 'para', 'por', 'ao', 'aos', 'seu', 'sua',
  // EN
  'the', 'of', 'an', 'and', 'in', 'on', 'to', 'for', 'is', 'at', 'by', 'with', 'his', 'her', 'my', 'i',
  // nível/classe
  'level', 'class', 'rank', 'tier', 'grade',
]);

export function toKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

/** Traduz PT→EN via MyMemory (grátis, com CORS). Falha em silêncio (null). */
async function translateToEnglish(text: string, signal?: AbortSignal): Promise<string | null> {
  if (!text.trim()) return null;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=pt|en`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { responseData?: { translatedText?: string } };
    const t = json.responseData?.translatedText?.trim();
    return t || null;
  } catch {
    return null;
  }
}

/**
 * Consultas a tentar, em ordem: tradução PT→EN, palavras-chave da tradução
 * aparando da frente (o "miolo" do nome costuma ficar no fim) e, por fim, as
 * palavras-chave do original. Exportado para teste.
 */
export function fallbackQueries(original: string, translated: string | null): string[] {
  const out: string[] = [];
  if (translated && translated.toLowerCase() !== original.toLowerCase()) {
    out.push(translated);
    const kw = toKeywords(translated);
    for (let i = 0; i < kw.length - 1; i++) out.push(kw.slice(i).join(' '));
  }
  const kwPt = toKeywords(original);
  if (kwPt.length) out.push(kwPt.join(' '));
  return [...new Set(out.filter((c) => c.trim()))];
}

/**
 * Busca resultados no MangaDex para o usuário escolher. Para na primeira
 * consulta com resultados (ver fallbackQueries).
 */
export async function searchManga(
  query: string,
  { limit = 12, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<{ results: MangaSearchResult[]; usedQuery: string }> {
  const q = query.trim();
  if (!q) return { results: [], usedQuery: '' };
  try {
    let results = await searchOnce(q, limit, signal);
    if (results.length) return { results, usedQuery: q };

    const en = await translateToEnglish(q, signal);
    for (const c of fallbackQueries(q, en)) {
      results = await searchOnce(c, limit, signal);
      if (results.length) return { results, usedQuery: c };
    }
    return { results: [], usedQuery: q };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { results: [], usedQuery: q };
  }
}

/**
 * Capas das obras mais seguidas no MangaDex, usadas como fundo da tela de
 * login. Thumbnails de 256px e só conteúdo safe/suggestive. Falha em silêncio.
 */
export async function fetchPopularCovers(limit = 24): Promise<string[]> {
  try {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.append('includes[]', 'cover_art');
    params.append('order[followedCount]', 'desc');
    params.append('contentRating[]', 'safe');
    params.append('contentRating[]', 'suggestive');
    params.append('hasAvailableChapters', 'true');
    const res = await mdFetch(`${API}/manga?${params.toString()}`);
    if (!res.ok) return [];
    const { data } = (await res.json()) as { data?: MdManga[] };
    return (data ?? []).map((m) => buildCoverUrl(m, 256)).filter((u): u is string => Boolean(u));
  } catch {
    return [];
  }
}

/** Melhor capa para uma obra: por UUID quando houver, senão pelo título. */
export async function fetchCover({
  title,
  mangaId,
}: {
  title?: string | null;
  mangaId?: string | null;
}): Promise<CoverMatch | null> {
  try {
    if (mangaId) {
      const byId = await coverByMangaId(mangaId);
      if (byId) return byId;
    }
    if (title?.trim()) {
      const [first] = (await searchOnce(title.trim(), 1)) ?? [];
      return first ? { url: first.coverUrl, matchedTitle: first.title } : null;
    }
    return null;
  } catch {
    return null;
  }
}
