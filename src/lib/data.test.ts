import { describe, expect, it } from 'vitest';
import { stepChapter, isStatusKey } from './constants';
import { buildObraPayload, normalizeGeneros, normalizeNota } from './db';
import { buildPublicSnapshot, toPublicObra, ShareTooLargeError, genToken } from './share';
import { buildCoverUrl, fallbackQueries, pickTitle, toKeywords } from './cover';
import { extractUrl } from '../hooks/useShareTarget';
import { translations } from '../i18n/translations';
import type { AppUser, Obra } from '../types';

const obra: Obra = {
  id: 'o1',
  titulo: 'Chainsaw Man',
  tipo: 'manga',
  site: 'Sakura Mangás',
  siteKey: 'sakura',
  capituloAtual: '97',
  status: 'lendo',
  nota: 9,
  generos: ['ação'],
  capa: 'https://uploads.mangadex.org/covers/x/y.512.jpg',
  notasLivres: 'segredo',
  urlOrigem: 'https://sakuramangas.org/obras/chainsaw-man/97',
};

describe('constants', () => {
  it('stepChapter avança e volta preservando decimais', () => {
    expect(stepChapter('97', 1)).toBe('98');
    expect(stepChapter('20.5', 1)).toBe('21.5');
    expect(stepChapter('0.1', 1)).toBe('1.1');
    expect(stepChapter('1', -1)).toBe('0');
    expect(stepChapter('0', -1)).toBe('0');
  });

  it('stepChapter com capítulo não numérico', () => {
    expect(stepChapter('extra', 1)).toBe('1');
    expect(stepChapter('extra', -1)).toBeNull();
  });

  it('isStatusKey', () => {
    expect(isStatusKey('concluído')).toBe(true);
    expect(isStatusKey('concluido')).toBe(false);
  });
});

describe('db: payload', () => {
  it('normalizeNota', () => {
    expect(normalizeNota('9')).toBe(9);
    expect(normalizeNota('')).toBeNull();
    expect(normalizeNota('abc')).toBeNull();
    expect(normalizeNota(42)).toBe(10);
    expect(normalizeNota(-3)).toBe(1);
    expect(normalizeNota('7.25')).toBe(7.3);
  });

  it('normalizeGeneros remove vazios e duplicados (sem diferenciar maiúsculas)', () => {
    expect(normalizeGeneros([' Ação ', 'ação', '', 'Drama'])).toEqual(['Ação', 'Drama']);
    expect(normalizeGeneros('ação')).toEqual([]);
  });

  it('buildObraPayload aplica defaults e corrige valores inválidos', () => {
    const p = buildObraPayload({ titulo: '  Frieren ', status: 'xyz' as never, tipo: 'novel' as never, capituloAtual: '', capa: '  ' });
    expect(p).toMatchObject({ titulo: 'Frieren', status: 'lendo', tipo: 'manga', capituloAtual: '1', capa: null, nota: null, generos: [] });
  });

  it('buildObraPayload nunca inclui userId nem id', () => {
    const p = buildObraPayload({ ...obra, nota: '8' });
    expect(p).not.toHaveProperty('userId');
    expect(p).not.toHaveProperty('id');
    expect(p.nota).toBe(8);
  });
});

describe('share', () => {
  const user: AppUser = { uid: 'u1', displayName: 'Victor', email: 'v@x.com', photoURL: null };

  it('toPublicObra não vaza nota, gêneros, anotações nem URL', () => {
    const pub = toPublicObra(obra);
    expect(Object.keys(pub).sort()).toEqual(['capa', 'capituloAtual', 'id', 'site', 'siteKey', 'status', 'tipo', 'titulo']);
  });

  it('buildPublicSnapshot usa o apelido e cai para o e-mail', () => {
    expect(buildPublicSnapshot(user, [obra]).ownerName).toBe('Victor');
    expect(buildPublicSnapshot({ ...user, displayName: null }, []).ownerName).toBe('v');
  });

  it('buildPublicSnapshot recusa lista acima do limite do Firestore', () => {
    const huge = Array.from({ length: 6000 }, (_, i) => ({ ...obra, id: `o${i}`, titulo: 'x'.repeat(200) }));
    expect(() => buildPublicSnapshot(user, huge)).toThrow(ShareTooLargeError);
  });

  it('genToken gera 32 hex', () => {
    expect(genToken()).toMatch(/^[0-9a-f]{32}$/);
    expect(genToken()).not.toBe(genToken());
  });
});

describe('cover', () => {
  it('toKeywords remove acentos e stopwords', () => {
    expect(toKeywords('O Retorno do Herói de Nível Máximo')).toEqual(['retorno', 'heroi', 'nivel', 'maximo']);
  });

  it('fallbackQueries: tradução, sufixos de palavras-chave e original', () => {
    expect(fallbackQueries('Solo Leveling', 'Solo Leveling')).toEqual(['solo leveling']);
    expect(fallbackQueries('A Volta do Mago', 'The Return of the Mage')).toEqual([
      'The Return of the Mage',
      'return mage',
      'volta mago',
    ]);
  });

  it('pickTitle prefere inglês, depois romaji', () => {
    expect(pickTitle({ id: 'x', attributes: { title: { 'ja-ro': 'Sousou no Frieren', en: 'Frieren' } } })).toBe('Frieren');
    expect(pickTitle({ id: 'x', attributes: { title: { 'ja-ro': 'Sousou no Frieren' } } })).toBe('Sousou no Frieren');
  });

  it('buildCoverUrl', () => {
    const m = { id: 'abc', relationships: [{ type: 'cover_art', attributes: { fileName: 'f.jpg' } }] };
    expect(buildCoverUrl(m)).toBe('https://uploads.mangadex.org/covers/abc/f.jpg.512.jpg');
    expect(buildCoverUrl(m, 256)).toBe('https://uploads.mangadex.org/covers/abc/f.jpg.256.jpg');
    expect(buildCoverUrl({ id: 'abc' })).toBeNull();
  });
});

describe('share target', () => {
  it('extractUrl acha a URL no meio do texto', () => {
    expect(extractUrl('Olha isso https://sakuramangas.org/obras/x/2 muito bom')).toBe('https://sakuramangas.org/obras/x/2');
    expect(extractUrl('sem link')).toBeNull();
  });
});

describe('i18n', () => {
  it('todos os idiomas têm as mesmas chaves e nenhum texto vazio', () => {
    const keys = Object.keys(translations.pt).sort();
    for (const dict of Object.values(translations)) {
      expect(Object.keys(dict).sort()).toEqual(keys);
      for (const v of Object.values(dict)) expect(v.trim()).not.toBe('');
    }
  });

  it('nenhum texto usa emoji (direção visual do redesign)', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const dict of Object.values(translations)) {
      for (const [k, v] of Object.entries(dict)) expect(emoji.test(v), k).toBe(false);
    }
  });
});
