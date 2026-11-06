import { useMemo } from 'react';
import PublicList from './screens/PublicList';
import Shelf from './screens/Shelf';

/** Rota da lista pública: /lista/{token} */
function getSharePath(): string | null {
  const m = window.location.pathname.match(/^\/lista\/([^/]+)\/?$/);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/**
 * Roteamento: /lista/{token} abre a estante compartilhada (sem login);
 * qualquer outra rota abre o app.
 */
export default function App() {
  const sharePath = useMemo(getSharePath, []);
  // Lista pública: não precisa de auth, obras nem tema do dono.
  if (sharePath) return <PublicList token={sharePath} />;
  return <Shelf />;
}
