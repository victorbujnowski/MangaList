// Service worker de limpeza para o endereço antigo.
// Quem tinha o app antigo instalado ainda tem um SW que serve a cópia em cache.
// Ao buscar atualização, ele recebe este arquivo: apaga os caches, se
// desregistra e recarrega as abas, que então caem no redirecionamento.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) client.navigate(client.url);
    })()
  );
});
