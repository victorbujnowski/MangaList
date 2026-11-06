// Compartilhamento de lista por link.
//
// Modelo: a lista pública é uma CÓPIA reduzida das obras, gravada em
// `publicLists/{token}`. As obras originais continuam privadas. O token é
// aleatório (o link só funciona para quem o tem) e fica salvo no perfil do dono
// em `users/{uid}.shareToken`. Desligar = apagar o documento público.

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, requireDb } from './firebase';
import type { AppUser, Obra, PublicListDoc, PublicObra } from '../types';

const PUBLIC = 'publicLists';
const USERS = 'users';

/** Firestore limita documentos a 1 MiB; deixamos folga para metadados. */
const PUBLIC_LIST_MAX_BYTES = 900_000;

export class ShareTooLargeError extends Error {
  constructor() {
    super('share_too_large');
    this.name = 'ShareTooLargeError';
  }
}

/** Token aleatório de 32 chars hex: inviável de adivinhar, sem dependências. */
export function genToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Reduz a obra ao que o card público exibe (sem nota, gêneros, notas ou URL). */
export function toPublicObra(o: Obra): PublicObra {
  return {
    id: o.id,
    titulo: o.titulo,
    tipo: o.tipo || 'manga',
    site: o.site || '',
    siteKey: o.siteKey || '',
    capituloAtual: String(o.capituloAtual ?? ''),
    status: o.status || 'lendo',
    capa: o.capa || null,
  };
}

export function buildPublicSnapshot(user: AppUser, obras: Obra[]): PublicListDoc {
  const snapshot: PublicListDoc = {
    ownerId: user.uid,
    ownerName: user.displayName || user.email?.split('@')[0] || '',
    obras: obras.map(toPublicObra),
  };
  // Estimativa por JSON (UTF-8): barato e suficiente para evitar a escrita recusada.
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).length;
  if (bytes > PUBLIC_LIST_MAX_BYTES) throw new ShareTooLargeError();
  return snapshot;
}

/** Token de compartilhamento atual do usuário (ou null se não compartilha). */
export async function getShareToken(uid: string): Promise<string | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, USERS, uid));
  const token = snap.exists() ? (snap.data() as { shareToken?: string | null }).shareToken : null;
  return token || null;
}

/** Liga o compartilhamento: gera token, grava a cópia pública e salva o token. */
export async function enableShare(user: AppUser, obras: Obra[]): Promise<string> {
  const firestore = requireDb();
  const token = genToken();
  await setDoc(doc(firestore, PUBLIC, token), {
    ...buildPublicSnapshot(user, obras),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(firestore, USERS, user.uid), { shareToken: token }, { merge: true });
  return token;
}

/** Atualiza a cópia pública (chamado ao vivo quando a lista muda). */
export async function syncShare(token: string, user: AppUser, obras: Obra[]): Promise<void> {
  await setDoc(
    doc(requireDb(), PUBLIC, token),
    { ...buildPublicSnapshot(user, obras), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Desliga: apaga a cópia pública e limpa o token do perfil. */
export async function disableShare(uid: string, token: string | null): Promise<void> {
  const firestore = requireDb();
  if (token) await deleteDoc(doc(firestore, PUBLIC, token));
  await setDoc(doc(firestore, USERS, uid), { shareToken: null }, { merge: true });
}

/** Lê uma lista pública pelo token (sem login). */
export async function getPublicList(token: string): Promise<PublicListDoc | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, PUBLIC, token));
  return snap.exists() ? (snap.data() as PublicListDoc) : null;
}
