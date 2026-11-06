import { useState, useEffect, useCallback } from 'react';

/** Primeira URL http(s) dentro de um texto ("Leia isto https://… agora"). */
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? null;
}

/**
 * Lê a URL recebida via Web Share Target (manifesto: params url/title/text).
 * Quando o app abre pelo "Compartilhar" do celular, o capítulo chega na query.
 * Lemos uma vez, limpamos a query e devolvemos o valor.
 */
export function useShareTarget() {
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Alguns navegadores mandam o link em `text` (às vezes junto com o título).
    const shared =
      extractUrl(params.get('url')) ??
      extractUrl(params.get('text')) ??
      extractUrl(params.get('title')) ??
      // Sem "http": entrega o valor cru (o parser completa com https://).
      (params.get('url')?.trim() || null);
    if (params.has('url') || params.has('text') || params.has('title')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (shared) setSharedUrl(shared);
  }, []);

  const clearShared = useCallback(() => setSharedUrl(null), []);

  return { sharedUrl, clearShared };
}
