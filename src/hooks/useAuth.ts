import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured, requireAuth } from '../lib/firebase';
import type { TranslationKey } from '../i18n/translations';
import type { AppUser } from '../types';

/** Usuário fictício do modo local: "logado" automaticamente, sem backend. */
const LOCAL_USER: AppUser = {
  uid: 'local',
  displayName: null,
  email: null,
  photoURL: null,
  isLocal: true,
};

/** Códigos do Firebase Auth → chaves de tradução (resolvidas na UI via t()). */
const AUTH_ERROR_KEYS: Record<string, TranslationKey> = {
  'auth/invalid-email': 'autherr_invalid_email',
  'auth/user-disabled': 'autherr_user_disabled',
  'auth/user-not-found': 'autherr_user_not_found',
  'auth/wrong-password': 'autherr_wrong_password',
  'auth/invalid-credential': 'autherr_invalid_credential',
  'auth/email-already-in-use': 'autherr_email_in_use',
  'auth/weak-password': 'autherr_weak_password',
  'auth/missing-password': 'autherr_missing_password',
  'auth/popup-closed-by-user': 'autherr_popup_closed',
  'auth/cancelled-popup-request': 'autherr_popup_closed',
  'auth/popup-blocked': 'autherr_popup_blocked',
  'auth/too-many-requests': 'autherr_too_many',
  'auth/network-request-failed': 'autherr_network',
  'auth/operation-not-allowed': 'autherr_not_allowed',
};

function authErrorKey(e: unknown): TranslationKey {
  const code = (e as { code?: string } | null)?.code;
  return (code && AUTH_ERROR_KEYS[code]) || 'autherr_generic';
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reauth: true }
  | { ok: false; reauth?: false; messageKey: TranslationKey };

/**
 * Estado de autenticação. Com Firebase: Google e e-mail/senha (cadastro e
 * recuperação). Sem credenciais: usuário local já "logado".
 *
 * As ações devolvem `true` no sucesso e `false` na falha (a chave do erro fica
 * em `error`), o que simplifica o controle de fluxo na UI.
 */
export function useAuth() {
  // undefined = ainda não sabemos (Firebase resolvendo a sessão)
  const [user, setUser] = useState<AppUser | null | undefined>(
    isFirebaseConfigured ? undefined : LOCAL_USER
  );
  const [error, setError] = useState<TranslationKey | null>(null);
  // updateProfile muta o User do Firebase in-place; este tick força o re-render.
  const [, bumpProfile] = useState(0);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (u) => setUser(u ?? null));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  /** Envolve uma ação: limpa o erro, executa e converte falha em chave i18n. */
  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(authErrorKey(e));
      return false;
    }
  }, []);

  const loginGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !googleProvider) {
      setUser(LOCAL_USER);
      return true;
    }
    const provider = googleProvider;
    return run(() => signInWithPopup(requireAuth(), provider));
  }, [run]);

  const loginEmail = useCallback(
    async (email: string, password: string) => {
      if (!isFirebaseConfigured) {
        setUser({ ...LOCAL_USER, email });
        return true;
      }
      return run(() => signInWithEmailAndPassword(requireAuth(), email.trim(), password));
    },
    [run]
  );

  const registerEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const name = displayName?.trim();
      if (!isFirebaseConfigured) {
        setUser({ ...LOCAL_USER, email, displayName: name || null });
        return true;
      }
      return run(async () => {
        const cred = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
        if (name) {
          await updateProfile(cred.user, { displayName: name });
          bumpProfile((n) => n + 1);
        }
      });
    },
    [run]
  );

  const resetPassword = useCallback(
    async (email: string) => {
      if (!isFirebaseConfigured) return true;
      return run(() => sendPasswordResetEmail(requireAuth(), email.trim()));
    },
    [run]
  );

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setUser(null);
      return;
    }
    await signOut(requireAuth());
  }, []);

  /** Atualiza o apelido. Reflete em todo o app, inclusive na lista pública. */
  const updateDisplayName = useCallback(
    async (name: string) => {
      const clean = name.trim();
      if (!isFirebaseConfigured) {
        setUser((u) => ({ ...(u ?? LOCAL_USER), displayName: clean || null }));
        return true;
      }
      const ok = await run(async () => {
        const current = requireAuth().currentUser;
        if (!current) throw new Error('no-user');
        await updateProfile(current, { displayName: clean });
      });
      if (ok) bumpProfile((n) => n + 1);
      return ok;
    },
    [run]
  );

  /** Troca a senha. Pode exigir login recente: aí a UI oferece o e-mail de redefinição. */
  const changePassword = useCallback(async (newPassword: string): Promise<ChangePasswordResult> => {
    setError(null);
    if (!isFirebaseConfigured) return { ok: true };
    try {
      const current = requireAuth().currentUser;
      if (!current) throw new Error('no-user');
      await updatePassword(current, newPassword);
      return { ok: true };
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/requires-recent-login') return { ok: false, reauth: true };
      return { ok: false, messageKey: authErrorKey(e) };
    }
  }, []);

  return {
    user: user ?? null,
    loading: user === undefined,
    error,
    clearError,
    loginGoogle,
    loginEmail,
    registerEmail,
    resetPassword,
    updateDisplayName,
    changePassword,
    logout,
    isLocal: !isFirebaseConfigured,
  };
}
