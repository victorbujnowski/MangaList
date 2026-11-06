import { flushSync } from 'react-dom';

/** Respeita a preferência do sistema por menos animação (acessibilidade). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Aplica `update` dentro de uma View Transition: anima reordenação, entrada e
 * saída dos cards (cada um com seu `view-transition-name`).
 *
 * `flushSync` é obrigatório: a API captura o "antes" ao ser chamada e o "depois"
 * ao fim do callback, então o React precisa aplicar o DOM de forma síncrona.
 * Sem suporte (Firefox/Safari antigos) ou com menos animação, atualiza direto.
 */
export function animateLayout(update: () => void): void {
  if (
    typeof document === 'undefined' ||
    !document.startViewTransition ||
    // Aba em segundo plano não desenha quadros: a transição só atrasaria o estado.
    document.visibilityState === 'hidden' ||
    prefersReducedMotion()
  ) {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}
