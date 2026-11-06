import { useState, useEffect, useCallback } from 'react';
import { isFirebaseConfigured } from '../lib/firebase';
import { animateLayout } from '../lib/viewTransition';
import * as dbApi from '../lib/db';
import type { Obra, ObraDraft } from '../types';

/**
 * Fonte das obras com fallback automático:
 * - Firebase configurado → assina o Firestore em tempo real e persiste lá.
 * - Sem credenciais → estado em memória (começa vazio; dura até recarregar).
 *
 * O CRUD tem a mesma assinatura nos dois modos e sempre devolve Promise, que
 * REJEITA em caso de falha: quem chama decide como avisar o usuário.
 */
export function useObras(userId: string | null | undefined) {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    // Troca de conta ou logout: nunca mostra a lista do usuário anterior.
    setObras([]);
    setLoadError(null);

    if (!isFirebaseConfigured || !userId) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let first = true;
    return dbApi.subscribeToObras(
      userId,
      (data) => {
        // A primeira carga entra direto; as seguintes animam a reordenação
        // (ex.: bater capítulo leva o card ao topo, ordenado por atualizadoEm).
        const apply = () => {
          setObras(data);
          setLoading(false);
        };
        if (first) {
          first = false;
          apply();
        } else {
          animateLayout(apply);
        }
      },
      (err) => {
        console.error('[MangaList] Falha ao ler obras do Firestore:', err);
        setLoadError(err);
        setLoading(false);
      }
    );
  }, [userId]);

  const addObra = useCallback(
    async (data: ObraDraft): Promise<void> => {
      if (isFirebaseConfigured) {
        if (!userId) throw new Error('no-user');
        await dbApi.addObra(userId, data);
        return;
      }
      const obra: Obra = { ...dbApi.buildObraPayload(data), id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` };
      animateLayout(() => setObras((prev) => [obra, ...prev]));
    },
    [userId]
  );

  const updateObra = useCallback(async (id: string, data: ObraDraft): Promise<void> => {
    if (isFirebaseConfigured) {
      await dbApi.updateObra(id, data);
      return;
    }
    // Modo local imita o Firestore: obra editada sobe para o topo.
    animateLayout(() =>
      setObras((prev) => {
        const current = prev.find((o) => o.id === id);
        if (!current) return prev;
        return [{ ...current, ...dbApi.buildObraPayload(data) }, ...prev.filter((o) => o.id !== id)];
      })
    );
  }, []);

  const updateCapitulo = useCallback(async (id: string, capitulo: string): Promise<void> => {
    if (isFirebaseConfigured) {
      await dbApi.updateCapitulo(id, capitulo);
      return;
    }
    animateLayout(() =>
      setObras((prev) => {
        const current = prev.find((o) => o.id === id);
        if (!current) return prev;
        return [{ ...current, capituloAtual: capitulo }, ...prev.filter((o) => o.id !== id)];
      })
    );
  }, []);

  const deleteObra = useCallback(async (id: string): Promise<void> => {
    if (isFirebaseConfigured) {
      await dbApi.deleteObra(id);
      return;
    }
    animateLayout(() => setObras((prev) => prev.filter((o) => o.id !== id)));
  }, []);

  return { obras, loading, loadError, addObra, updateObra, updateCapitulo, deleteObra };
}
