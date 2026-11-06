/**
 * URL Parser: extrai título, capítulo e fonte a partir da URL de um capítulo.
 * Suporta: Sakura Mangás, Kitsune Yako, MangaDex.
 */
import type { SiteKey, TipoKey } from '../types';

export interface SiteDef {
  name: string;
  type: TipoKey;
  domains: string[];
  patterns: RegExp[];
  /** Devolve o título legível, ou null quando o slug não serve (ex.: UUID). */
  slugToTitle: (slug: string) => string | null;
}

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CHAPTER = '(\\d+(?:[._]\\d+)?)';

export const SITES: Record<SiteKey, SiteDef> = {
  sakura: {
    name: 'Sakura Mangás',
    type: 'manga',
    domains: ['sakuramangas.com', 'sakuramangas.org'],
    // ex: /obras/hatori-to-furuta-no-hinichijou-sahanji/12/
    // ex: /manga/chainsaw-man/capitulo-20
    patterns: [
      new RegExp(`/(?:manga|ler|obras?|serie)/([^/]+)/(?:capitulo|cap|chapter)-?${CHAPTER}`, 'i'),
      new RegExp(`/(?:manga|ler|obras?|serie)/([^/]+)/${CHAPTER}/?$`, 'i'),
    ],
    slugToTitle: (slug) => slug.replace(/-/g, ' '),
  },

  kitsune: {
    name: 'Kitsune Yako',
    type: 'webtoon',
    domains: ['kitsuneyako.com', 'kitsuneyako.net', 'kitsuneyako.org'],
    // ex: /necromante-o-rei-da-calamidade-capitulo-273/
    // ex: /serie/titulo/12/
    patterns: [
      new RegExp(
        `/(?:webtoon|serie|obras?|manga)/([^/]+)/(?:capitulo|cap|episode|ep|chapter)-?${CHAPTER}`,
        'i'
      ),
      new RegExp(`/(?:webtoon|serie|obras?|manga)/([^/]+)/${CHAPTER}/?$`, 'i'),
      new RegExp(`/(.+?)-(?:capitulo|cap|episode|ep|chapter)-?${CHAPTER}/?$`, 'i'),
    ],
    slugToTitle: (slug) => slug.replace(/-/g, ' '),
  },

  mangadex: {
    name: 'MangaDex',
    type: 'manga',
    domains: ['mangadex.org'],
    // ex: /title/uuid/common-and-widespread  → extrai título do slug
    // ex: /chapter/uuid                      → só UUID, pede título manual
    patterns: [/\/title\/[a-f0-9-]+\/([^/?#]+)/i, /\/chapter\/([a-f0-9-]+)/i],
    slugToTitle: (slug) => (UUID_RE.test(slug) ? null : slug.replace(/-/g, ' ')),
  },
};

export const SITE_KEYS = Object.keys(SITES) as SiteKey[];

export type ParseErrorKey = 'urlerr_empty' | 'urlerr_invalid' | 'urlerr_site' | 'urlerr_notitle';

export type ParseResult =
  | {
      success: true;
      site: string;
      siteKey: SiteKey;
      type: TipoKey;
      title: string | null;
      chapter: string | null;
      mangaId: string | null;
      needsManualTitle: boolean;
    }
  | {
      success: false;
      errorKey: ParseErrorKey;
      errorParams?: Record<string, string>;
    };

/** "20", "20.5", "20_5", "007" → "20", "20.5", "20.5", "7" */
export function normalizeChapter(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace('_', '.').replace(/^0+(\d)/, '$1');
}

/** Capitaliza a primeira letra de cada palavra. */
export function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Detecta o site pelo hostname. Compara o domínio exato ou subdomínio
 * (www.sakuramangas.com), nunca substring: "sakuramangas.com.evil.io" não casa.
 */
export function detectSite(hostname: string): (SiteDef & { key: SiteKey }) | null {
  const host = hostname.toLowerCase();
  for (const key of SITE_KEYS) {
    const site = SITES[key];
    if (site.domains.some((d) => host === d || host.endsWith(`.${d}`))) {
      return { key, ...site };
    }
  }
  return null;
}

/** decodeURIComponent que não lança em sequências % malformadas. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Recebe uma URL e devolve os dados extraídos ou a chave de erro (i18n). */
export function parseUrl(rawUrl: string | null | undefined): ParseResult {
  const trimmed = (rawUrl ?? '').trim();
  if (!trimmed) return { success: false, errorKey: 'urlerr_empty' };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { success: false, errorKey: 'urlerr_invalid' };
  }

  const site = detectSite(url.hostname);
  if (!site) {
    return { success: false, errorKey: 'urlerr_site', errorParams: { host: url.hostname } };
  }

  const { pathname } = url;
  let title: string | null = null;
  let chapter: string | null = null;
  let needsManualTitle = false;

  // No MangaDex, o UUID da obra (URLs /title/uuid) permite buscar a capa por id.
  let mangaId: string | null = null;
  if (site.key === 'mangadex') {
    mangaId = pathname.match(/\/title\/([0-9a-f-]{36})/i)?.[1] ?? null;
  }

  for (const pattern of site.patterns) {
    const match = pathname.match(pattern);
    if (!match?.[1]) continue;
    const resolved = site.slugToTitle(safeDecode(match[1]));
    if (resolved === null) needsManualTitle = true;
    else title = toTitleCase(resolved.trim());
    chapter = normalizeChapter(match[2]);
    break;
  }

  if (!title && !needsManualTitle) {
    return { success: false, errorKey: 'urlerr_notitle', errorParams: { site: site.name } };
  }

  return {
    success: true,
    site: site.name,
    siteKey: site.key,
    type: site.type,
    title,
    chapter,
    mangaId,
    needsManualTitle,
  };
}
