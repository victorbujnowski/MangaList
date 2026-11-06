import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore';
import { requireDb } from './firebase';
import { isStatusKey, TIPO_KEYS } from './constants';
import type { Obra, ObraDraft, ObraFields, TipoKey } from '../types';

const COLLECTION = 'obras';

/** "9", 9, "" → 9 | null. Fora de 1–10 é limitado; não numérico vira null. */
export function normalizeNota(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n * 10) / 10));
}

/** Gêneros únicos, sem espaços sobrando e sem vazios. */
export function normalizeGeneros(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of value) {
    const clean = String(g).trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

/** Payload de uma obra com defaults consistentes (sem timestamps). */
export function buildObraPayload(data: Partial<ObraDraft>): ObraFields {
  const tipo: TipoKey = TIPO_KEYS.includes(data.tipo as TipoKey) ? (data.tipo as TipoKey) : 'manga';
  return {
    titulo: (data.titulo ?? '').trim(),
    tipo,
    site: data.site ?? '',
    siteKey: data.siteKey ?? '',
    capituloAtual: String(data.capituloAtual ?? '').trim() || '1',
    status: isStatusKey(data.status) ? data.status : 'lendo',
    nota: normalizeNota(data.nota),
    generos: normalizeGeneros(data.generos),
    capa: data.capa?.trim() || null,
    notasLivres: data.notasLivres ?? '',
    urlOrigem: data.urlOrigem ?? '',
  };
}

/**
 * Assina as obras do usuário em tempo real. Devolve o unsubscribe.
 * `onError` recebe falhas do listener (ex.: índice composto ausente).
 */
export function subscribeToObras(
  userId: string,
  callback: (obras: Obra[]) => void,
  onError?: (err: FirestoreError) => void
): Unsubscribe {
  const q = query(
    collection(requireDb(), COLLECTION),
    where('userId', '==', userId),
    orderBy('atualizadoEm', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ObraFields) }))),
    (err) => onError?.(err)
  );
}

export async function addObra(userId: string, data: Partial<ObraDraft>): Promise<string> {
  const ref = await addDoc(collection(requireDb(), COLLECTION), {
    userId,
    ...buildObraPayload(data),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function updateObra(obraId: string, data: Partial<ObraDraft>): Promise<void> {
  // Só os campos editáveis: nunca userId nem criadoEm (as regras também barram).
  await updateDoc(doc(requireDb(), COLLECTION, obraId), {
    ...buildObraPayload(data),
    atualizadoEm: serverTimestamp(),
  });
}

export async function updateCapitulo(obraId: string, capitulo: string): Promise<void> {
  await updateDoc(doc(requireDb(), COLLECTION, obraId), {
    capituloAtual: String(capitulo),
    atualizadoEm: serverTimestamp(),
  });
}

export async function deleteObra(obraId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), COLLECTION, obraId));
}
