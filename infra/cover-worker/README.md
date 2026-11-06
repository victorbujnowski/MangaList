# Cover Worker (Cloudflare)

Worker que o app usa para encontrar capas. Roda no plano grátis da Cloudflare.

| Rota | O que faz |
|---|---|
| `GET /cover?page=<link>` | Lê a página da obra no Kitsune Yako e devolve `{ image, title }`: a capa e o título oficiais. Aceita link de capítulo ou de série. |
| `GET /?url=<link da api.mangadex.org>` | Repassa a API do MangaDex com CORS liberado. O app usa para descobrir o ID da obra no AniList. |

- Só aceita os hosts listados no topo de [`worker.js`](worker.js): não é um proxy aberto.
- Respostas de `/cover` ficam 1 dia no cache da borda.
- Se o site responder com verificação anti-bot, devolve `image: null`. Não há tentativa de contornar proteção.

## Publicar ou atualizar

Pelo painel, sem instalar nada:

1. Em **dash.cloudflare.com → Workers & Pages**, abra o Worker (ou crie um com **Create → Create Worker**).
2. Clique em **Edit code**, apague o conteúdo, cole o de [`worker.js`](worker.js) e clique em **Deploy**.
3. No `.env.local` do app, aponte para a URL do Worker terminando em `/?url=`:

   ```
   VITE_COVER_PROXY=https://SEU-WORKER.SEU-USUARIO.workers.dev/?url=
   ```

   Ao trocar de Worker, refaça o build e o deploy do app. Ao só atualizar o código do mesmo Worker, não precisa.

## Testar

```
https://SEU-WORKER.workers.dev/cover?page=https%3A%2F%2Fkitsuneyako.com%2Fmanga%2Fnecromante-o-rei-da-calamidade%2F
```

Deve devolver um JSON com `"image": "https://kitsuneyako.com/wp-content/uploads/..."`.
