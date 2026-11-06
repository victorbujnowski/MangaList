/**
 * MangaList: proxy de capas (Cloudflare Worker), v2.
 *
 * Rotas:
 *   GET /?url=<URL da api.mangadex.org encodada>
 *       Repassa a chamada com CORS liberado (a API do MangaDex só libera
 *       localhost). Usado para descobrir o ID da obra no AniList.
 *
 *   GET /cover?page=<URL do capítulo ou da série encodada>
 *       Lê a página da obra no site de leitura e devolve a capa e o título:
 *       { image: string|null, title: string|null }
 *       Hoje: Kitsune Yako (a partir do link do capítulo, abre a página da série).
 *
 * Não é um proxy aberto: só aceita os hosts listados abaixo. Respostas ficam
 * 1 dia no cache da borda, então cada obra é buscada no site no máximo 1x/dia.
 * Se o site responder com verificação anti-bot, devolvemos image=null: não há
 * tentativa de contornar proteção nenhuma.
 *
 * Como publicar: veja o README.md desta pasta.
 */

const API_HOSTS = ['api.mangadex.org'];
const SITE_HOSTS = ['kitsuneyako.com', 'kitsuneyako.net', 'kitsuneyako.org'];
const UA = 'MangaListCoverBot/2.0 (+https://mangalist-app.web.app)';
const DAY = 86400;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return json({ error: 'Só GET' }, 405);

    const reqUrl = new URL(request.url);
    if (reqUrl.pathname === '/cover') return cached(request, ctx, () => coverFromPage(reqUrl));
    if (reqUrl.pathname === '/' && reqUrl.searchParams.has('url')) return apiProxy(reqUrl);
    return json({ error: 'Rota desconhecida. Use /?url= ou /cover?page=' }, 404);
  },
};

/* ── Proxy da API do MangaDex (compatível com a v1) ─────────────── */

async function apiProxy(reqUrl) {
  const dest = parseHttpUrl(reqUrl.searchParams.get('url'));
  if (!dest) return json({ error: 'URL inválida' }, 400);
  if (!API_HOSTS.includes(dest.hostname)) return json({ error: 'Host não permitido' }, 403);
  try {
    const upstream = await fetch(dest.toString(), {
      headers: { 'User-Agent': UA },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    return json({ error: 'Falha ao buscar', detail: String(e) }, 502);
  }
}

/* ── Capa a partir da página da obra ────────────────────────────── */

async function coverFromPage(reqUrl) {
  const page = parseHttpUrl(reqUrl.searchParams.get('page'));
  if (!page) return json({ error: 'Parâmetro ?page= inválido' }, 400);
  const host = page.hostname.replace(/^www\./, '');
  if (!SITE_HOSTS.includes(host)) return json({ error: 'Site não suportado' }, 403);

  // Link de capítulo (/titulo-capitulo-12/) → página da série (/manga/titulo/).
  const seriesUrl = kitsuneSeriesUrl(page);
  const html = await fetchHtml(seriesUrl);
  if (!html) return json({ image: null, title: null });
  return json(extractCover(html, seriesUrl));
}

function kitsuneSeriesUrl(u) {
  if (/^\/manga\/[^/]+\/?$/.test(u.pathname)) return u.toString();
  const m = u.pathname.match(/^\/(?:(?:manga|serie|webtoon|obras?)\/)?([^/]+?)(?:-(?:capitulo|cap|episode|ep|chapter)-?[\d._]+)?\/?(?:[\d._]+\/?)?$/i);
  const slug = m ? m[1] : u.pathname.split('/').filter(Boolean)[0];
  return `${u.origin}/manga/${slug}/`;
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
      cf: { cacheTtl: DAY, cacheEverything: true },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Página de verificação anti-bot: desiste (não contornamos).
    if (/<title>\s*Just a moment/i.test(html)) return null;
    return html;
  } catch {
    return null;
  }
}

/**
 * Ordem: og:image → twitter:image → JSON-LD → <img> da área de uploads cujo
 * alt bate com o título da página (ignorando logos e ícones).
 */
function extractCover(html, baseUrl) {
  const title = decodeEntities(
    meta(html, 'og:title') || (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').replace(/<[^>]+>/g, '')
  ).trim() || null;

  const fromMeta = meta(html, 'og:image') || meta(html, 'twitter:image');
  if (fromMeta) return { image: absolute(fromMeta, baseUrl), title };

  const ld = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (ld) return { image: absolute(ld[1].replace(/\\\//g, '/'), baseUrl), title };

  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const candidates = imgs
    .map((tag) => ({ src: attr(tag, 'src') || attr(tag, 'data-src'), alt: decodeEntities(attr(tag, 'alt') || '') }))
    .filter((c) => c.src && /\/wp-content\/uploads\//.test(c.src) && !/logo|icon|avatar|banner/i.test(c.src));
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const byAlt = title && candidates.find((c) => c.alt && norm(c.alt) === norm(title));
  const pick = byAlt || candidates[0];
  return { image: pick ? absolute(pick.src, baseUrl) : null, title: title || pick?.alt || null };
}

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? attr(tag, 'content') : null;
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1] ?? null;
}

function absolute(src, base) {
  try {
    const u = new URL(decodeEntities(src), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/* ── Utilidades ─────────────────────────────────────────────────── */

function parseHttpUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

/** Cache da borda para /cover (1 dia). */
async function cached(request, ctx, produce) {
  const cache = caches.default;
  const key = new Request(request.url, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await produce();
  if (res.status === 200) {
    const copy = new Response(res.body, res);
    copy.headers.set('Cache-Control', `public, max-age=${DAY}`);
    ctx.waitUntil(cache.put(key, copy.clone()));
    return copy;
  }
  return res;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
