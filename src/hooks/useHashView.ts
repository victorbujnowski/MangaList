import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Uma "tela" ligada a um hash (#conta). Abrir empurra uma entrada no histórico,
 * então o botão/gesto de voltar do celular fecha a tela em vez de sair do app.
 */
export function useHashView(name: string) {
  const hash = `#${name}`;
  const [isOpen, setIsOpen] = useState(() => window.location.hash === hash);
  const pushed = useRef(false);

  useEffect(() => {
    const onChange = () => setIsOpen(window.location.hash === hash);
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, [hash]);

  const open = useCallback(() => {
    if (window.location.hash === hash) return;
    window.history.pushState(null, '', hash);
    pushed.current = true;
    setIsOpen(true);
    window.scrollTo(0, 0);
  }, [hash]);

  const close = useCallback(() => {
    if (window.location.hash !== hash) {
      setIsOpen(false);
      return;
    }
    if (pushed.current) {
      // Fomos nós que empurramos: voltar devolve o usuário para onde estava.
      pushed.current = false;
      window.history.back();
    } else {
      // Chegou direto em /#conta: só limpa o hash, sem sair do app.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setIsOpen(false);
    }
  }, [hash]);

  return { isOpen, open, close };
}
