import { describe, expect, it } from 'vitest';
import { detectSite, normalizeChapter, parseUrl } from './urlParser';

function ok(url: string) {
  const r = parseUrl(url);
  if (!r.success) throw new Error(`esperava sucesso para ${url}, veio ${r.errorKey}`);
  return r;
}

describe('parseUrl: Sakura Mangás', () => {
  it('lê /obras/<slug>/<n>/', () => {
    const r = ok('https://sakuramangas.org/obras/chainsaw-man/97/');
    expect(r).toMatchObject({ siteKey: 'sakura', site: 'Sakura Mangás', type: 'manga', title: 'Chainsaw Man', chapter: '97' });
  });

  it('lê /manga/<slug>/capitulo-<n> com capítulo fracionado', () => {
    expect(ok('sakuramangas.com/manga/one-piece/capitulo-1100_5')).toMatchObject({ title: 'One Piece', chapter: '1100.5' });
  });

  it('aceita subdomínio www', () => {
    expect(ok('https://www.sakuramangas.org/obras/dandadan/12').siteKey).toBe('sakura');
  });

  it('remove zeros à esquerda do capítulo', () => {
    expect(ok('https://sakuramangas.org/obras/frieren/007/').chapter).toBe('7');
  });
});

describe('parseUrl: Kitsune Yako', () => {
  it('lê o formato /<slug>-capitulo-<n>/', () => {
    const r = ok('https://kitsuneyako.com/necromante-o-rei-da-calamidade-capitulo-273/');
    expect(r).toMatchObject({ siteKey: 'kitsune', type: 'webtoon', title: 'Necromante O Rei Da Calamidade', chapter: '273' });
  });

  it('lê /serie/<slug>/<n>/', () => {
    expect(ok('https://kitsuneyako.net/serie/solo-leveling/45/')).toMatchObject({ title: 'Solo Leveling', chapter: '45' });
  });
});

describe('parseUrl: MangaDex', () => {
  const uuid = 'a1c7c817-4e59-43b7-9365-09675a149a6f';

  it('extrai título e UUID de /title/<uuid>/<slug>', () => {
    const r = ok(`https://mangadex.org/title/${uuid}/one-piece`);
    expect(r).toMatchObject({ siteKey: 'mangadex', title: 'One Piece', mangaId: uuid, needsManualTitle: false, chapter: null });
  });

  it('pede título manual em /chapter/<uuid>', () => {
    const r = ok(`https://mangadex.org/chapter/${uuid}`);
    expect(r).toMatchObject({ title: null, needsManualTitle: true, mangaId: null });
  });
});

describe('parseUrl: erros', () => {
  it.each([
    ['', 'urlerr_empty'],
    ['   ', 'urlerr_empty'],
    ['http://exa mple.com', 'urlerr_invalid'],
    ['https://example.com/obras/x/1', 'urlerr_site'],
    ['https://sakuramangas.org/', 'urlerr_notitle'],
  ])('%j → %s', (input, key) => {
    const r = parseUrl(input);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errorKey).toBe(key);
  });

  it('não confunde domínio parecido (sakuramangas.org.evil.io)', () => {
    const r = parseUrl('https://sakuramangas.org.evil.io/obras/x/1');
    expect(r.success).toBe(false);
  });

  it('não lança com % malformado no slug', () => {
    expect(() => parseUrl('https://sakuramangas.org/obras/abc%E0%A4%A/3')).not.toThrow();
  });
});

describe('helpers', () => {
  it('normalizeChapter', () => {
    expect(normalizeChapter('20_5')).toBe('20.5');
    expect(normalizeChapter('0')).toBe('0');
    expect(normalizeChapter(null)).toBeNull();
  });

  it('detectSite', () => {
    expect(detectSite('mangadex.org')?.key).toBe('mangadex');
    expect(detectSite('notmangadex.org')).toBeNull();
  });
});
