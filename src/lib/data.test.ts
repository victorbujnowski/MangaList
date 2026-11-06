import { describe, expect, it } from 'vitest';
import { stepChapter, isStatusKey } from './constants';
import { buildObraPayload, normalizeGeneros, normalizeNota } from './db';
import { buildPublicSnapshot, toPublicObra, ShareTooLargeError, genToken } from './share';
import {
  bestMatch,
  fallbackQueries,
  isBrokenCoverUrl,
  kitsuneSeriesUrlFromTitle,
  mangaDexNames,
  titleSimilarity,
  toKeywords,
} from './cover';
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

  it('fallbackQueries: tradução, sufixos com 3+ palavras e palavras-chave do original', () => {
    expect(fallbackQueries('Solo Leveling', 'Solo Leveling')).toEqual([]);
    expect(fallbackQueries('O Retorno do Herói de Nível Máximo', 'The Return of the Peak-Level Hero')).toEqual([
      'The Return of the Peak-Level Hero',
      'peak level hero',
      'retorno heroi nivel maximo',
    ]);
  });

  it('titleSimilarity ignora caixa, acento e pontuação', () => {
    expect(titleSimilarity('Kaiju No 8', 'Kaiju No.8')).toBe(1);
    expect(titleSimilarity('Sousou No Frieren', 'Sousou no Frieren')).toBe(1);
    expect(titleSimilarity('Necromante: O Rei da Calamidade', 'necromante o rei da calamidade')).toBe(1);
    expect(titleSimilarity('Frieren', 'Frieren: Beyond Journey’s End')).toBe(0.9);
    expect(titleSimilarity('Dandadan', 'One Piece')).toBe(0);
  });

  const media = (id: number, romaji: string, english: string | null = null, synonyms: string[] = []) => ({
    id,
    title: { romaji, english, native: null },
    synonyms,
    startDate: { year: 2020 },
    coverImage: { extraLarge: `https://s4.anilist.co/${id}.jpg`, large: null },
  });

  it('bestMatch escolhe o título mais parecido, inclusive por sinônimo', () => {
    const list = [media(1, 'Kaiju No. 8: B-Side'), media(2, 'Kaiju No.8'), media(3, 'Kaijuu')];
    expect(bestMatch('Kaiju No 8', list)?.media.id).toBe(2);
    expect(bestMatch('Aishiteru Game wo Owarasetai', [media(9, 'Aishiteru Game wo Owarasetai', 'I Want to End This Love Game')])?.media.id).toBe(9);
    expect(bestMatch('Rei Necromante', [media(5, 'Other', null, ['Rei Necromante'])])?.media.id).toBe(5);
  });

  it('bestMatch recusa resultado diferente (melhor sem capa do que capa errada)', () => {
    expect(bestMatch('Necromante O Rei Da Calamidade', [media(1, 'One Piece'), media(2, 'Berserk')])).toBeNull();
    expect(bestMatch('Kaiju No 8', [])).toBeNull();
  });

  it('kitsuneSeriesUrlFromTitle gera o slug do WordPress', () => {
    expect(kitsuneSeriesUrlFromTitle('Escola De Surpresas')).toBe('https://kitsuneyako.com/manga/escola-de-surpresas/');
    expect(kitsuneSeriesUrlFromTitle('Contos de Cultivação de um Regressor')).toBe(
      'https://kitsuneyako.com/manga/contos-de-cultivacao-de-um-regressor/'
    );
    expect(kitsuneSeriesUrlFromTitle('Necromante: O Rei da Calamidade')).toBe(
      'https://kitsuneyako.com/manga/necromante-o-rei-da-calamidade/'
    );
    expect(kitsuneSeriesUrlFromTitle('  ')).toBeNull();
  });

  it('mangaDexNames inclui os títulos alternativos (pt-br)', () => {
    const names = mangaDexNames({
      attributes: { title: { ko: 'Muhanui Mabeopsa' }, altTitles: [{ en: 'The Infinite Mage' }, { 'pt-br': 'Mago do infinito' }] },
    });
    expect(names).toEqual(['Muhanui Mabeopsa', 'The Infinite Mage', 'Mago do infinito']);
    expect(Math.max(...names.map((n) => titleSimilarity('Mago Do Infinito', n)))).toBe(1);
  });

  it('isBrokenCoverUrl marca capas do MangaDex e ausentes', () => {
    expect(isBrokenCoverUrl(null)).toBe(true);
    expect(isBrokenCoverUrl('https://uploads.mangadex.org/covers/a/b.jpg.512.jpg')).toBe(true);
    expect(isBrokenCoverUrl('https://s4.anilist.co/file/x.jpg')).toBe(false);
    expect(isBrokenCoverUrl('https://kitsuneyako.com/wp-content/uploads/2026/01/CapaNRM.webp')).toBe(false);
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
