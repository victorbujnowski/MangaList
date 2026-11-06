import type { Timestamp, FieldValue } from 'firebase/firestore';

/** Chaves gravadas no Firestore. Não renomear: quebraria dados existentes. */
export type StatusKey = 'lendo' | 'pausado' | 'concluído' | 'dropado';
export type TipoKey = 'manga' | 'webtoon' | 'manhua' | 'manhwa';
export type SiteKey = 'sakura' | 'kitsune' | 'mangadex';

/** Campos editáveis de uma obra (o que o formulário manipula). */
export interface ObraFields {
  titulo: string;
  tipo: TipoKey;
  site: string;
  siteKey: SiteKey | string;
  capituloAtual: string;
  status: StatusKey;
  nota: number | null;
  generos: string[];
  capa: string | null;
  notasLivres: string;
  urlOrigem: string;
}

/** Obra como chega do Firestore (ou do modo local). */
export interface Obra extends ObraFields {
  id: string;
  userId?: string;
  criadoEm?: Timestamp | FieldValue | null;
  atualizadoEm?: Timestamp | FieldValue | null;
}

/**
 * Estado do formulário: igual a ObraFields, mas `nota` pode estar como texto
 * enquanto o usuário digita. `buildObraPayload` normaliza antes de gravar.
 */
export interface ObraDraft extends Omit<ObraFields, 'nota' | 'capa'> {
  id?: string;
  nota: number | string | null;
  capa: string | null;
}

/** Versão reduzida exibida na lista pública (sem nota, gêneros nem anotações). */
export type PublicObra = Pick<
  Obra,
  'id' | 'titulo' | 'tipo' | 'site' | 'siteKey' | 'capituloAtual' | 'status' | 'capa'
>;

export interface PublicListDoc {
  ownerId: string;
  ownerName: string;
  obras: PublicObra[];
  updatedAt?: Timestamp | FieldValue;
}

/** Usuário mínimo que o app consome: o User do Firebase ou o fictício local. */
export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isLocal?: boolean;
  providerData?: ReadonlyArray<{ providerId: string }>;
}
