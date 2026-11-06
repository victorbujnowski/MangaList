import type { StatusKey, TipoKey } from '../types';

/**
 * Status, na ordem em que aparecem nos filtros e no formulário. As chaves batem
 * com o campo `status` do Firestore; os rótulos vêm do i18n (`status.<key>`).
 * A cor aponta para um token de tokens.css (muda com o tema).
 */
export const STATUS_CONFIG: Record<StatusKey, { color: string }> = {
  lendo: { color: 'var(--status-lendo)' },
  pausado: { color: 'var(--status-pausado)' },
  concluído: { color: 'var(--status-concluido)' },
  dropado: { color: 'var(--status-dropado)' },
};

export const STATUS_KEYS = Object.keys(STATUS_CONFIG) as StatusKey[];

/** Tipos, na ordem do seletor e dos filtros (rótulos: `tipo.<key>`). */
export const TIPO_KEYS: TipoKey[] = ['manga', 'webtoon', 'manhua', 'manhwa'];

export function isStatusKey(v: unknown): v is StatusKey {
  return typeof v === 'string' && v in STATUS_CONFIG;
}

/**
 * Próximo/anterior capítulo. Preserva a parte decimal (20.5 → 21.5) e nunca
 * desce abaixo de 0. Devolve null quando o capítulo não é numérico.
 */
export function stepChapter(current: string, delta: 1 | -1): string | null {
  const n = Number(current);
  if (current.trim() === '' || !Number.isFinite(n)) return delta === 1 ? '1' : null;
  const next = Math.max(0, n + delta);
  // Evita 0.30000000000000004 em capítulos fracionados.
  return String(Math.round(next * 100) / 100);
}
