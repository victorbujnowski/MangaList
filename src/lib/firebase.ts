// Firebase: inicializado apenas quando há credenciais no .env.local.
// Sem credenciais o app roda em "modo local" (dados em memória).
// Console: https://console.firebase.google.com

import { initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/**
 * Considera configurado quando os campos essenciais estão presentes.
 * VITE_FORCE_LOCAL=true (npm run dev:local) ignora as credenciais: útil para
 * testar a interface sem tocar nos dados reais.
 */
export const isFirebaseConfigured =
  env.VITE_FORCE_LOCAL !== 'true' &&
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let db: Firestore | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} else if (env.DEV) {
  console.info(
    '[MangaList] Firebase não configurado: rodando em modo local. ' +
      'Crie um .env.local a partir de .env.example para persistir no Firestore.'
  );
}

export { db, auth, googleProvider };

/** Firestore garantido (só chame em caminhos onde isFirebaseConfigured é true). */
export function requireDb(): Firestore {
  if (!db) throw new Error('Firestore não configurado');
  return db;
}

export function requireAuth(): Auth {
  if (!auth) throw new Error('Firebase Auth não configurado');
  return auth;
}
