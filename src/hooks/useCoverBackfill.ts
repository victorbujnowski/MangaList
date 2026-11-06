import { useEffect, useRef } from 'react';
import { findCover, isBrokenCoverUrl } from '../lib/cover';
import { parseUrl } from '../lib/urlParser';
import type { Obra } from '../types';

// v2: a cadeia de capas mudou (Worker v2, nomes pt-br); tentativas antigas são descartadas.
const STORAGE_KEY = 'mangalist:cover-attempts:v2';
/** Obra sem capa encontrada só é tentada de novo depois deste prazo. */
const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
/** Espera inicial (a estante aparece primeiro) e intervalo entre obras (limite do AniList). */
const START_DELAY_MS = 2500;
const GAP_MS = 2500;

function loadAttempts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function saveAttempt(id: string) {
  try {
    const all = loadAttempts();
    all[id] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* sem storage: tenta de novo na próxima sessão */
  }
}

/**
 * Recuperação automática de capas: obras sem capa, ou com capa do MangaDex
 * (que não aparece mais fora do site deles), ganham capa sozinhas em segundo
 * plano, uma por vez. Só escreve a capa; não mexe na ordem da estante.
 */
export function useCoverBackfill(
  obras: Obra[],
  enabled: boolean,
  updateCapa: (id: string, capa: string) => Promise<void>
) {
  const inFlight = useRef(new Set<string>());
  const obrasRef = useRef(obras);
  obrasRef.current = obras;

  // Só reage à lista de ids que precisam de capa, não a cada mudança de capítulo.
  const pendingKey = obras
    .filter((o) => isBrokenCoverUrl(o.capa))
    .map((o) => o.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (!enabled || !pendingKey) return undefined;
    const ctrl = new AbortController();
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms);
        ctrl.signal.addEventListener('abort', () => window.clearTimeout(id));
      });

    (async () => {
      await sleep(START_DELAY_MS);
      const attempts = loadAttempts();
      const now = Date.now();
      const queue = pendingKey
        .split(',')
        .filter((id) => !inFlight.current.has(id) && now - (attempts[id] ?? 0) > RETRY_AFTER_MS);

      for (const id of queue) {
        if (ctrl.signal.aborted) return;
        const obra = obrasRef.current.find((o) => o.id === id);
        if (!obra || !isBrokenCoverUrl(obra.capa)) continue;
        inFlight.current.add(id);
        try {
          const parsed = obra.urlOrigem ? parseUrl(obra.urlOrigem) : null;
          const result = await findCover({
            pageUrl: obra.urlOrigem || null,
            siteKey: obra.siteKey,
            title: obra.titulo,
            mangaId: parsed?.success ? parsed.mangaId : null,
            signal: ctrl.signal,
          });
          if (result) await updateCapa(id, result.url);
          saveAttempt(id);
        } catch {
          if (ctrl.signal.aborted) return;
        } finally {
          inFlight.current.delete(id);
        }
        await sleep(GAP_MS);
      }
    })();

    return () => ctrl.abort();
  }, [enabled, pendingKey, updateCapa]);
}
