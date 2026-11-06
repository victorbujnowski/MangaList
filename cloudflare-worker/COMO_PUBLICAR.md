# Publicar o proxy de capa no Cloudflare Workers (grátis, sem cartão)

O arquivo `manga-proxy.js` (v2) faz duas coisas para o app:
- `/cover?page=<link>`: lê a capa e o título oficiais na página da obra (Kitsune Yako);
- `/?url=<api.mangadex.org/...>`: repassa a API do MangaDex com CORS (para achar o ID no AniList).

## Já tem o Worker (atualizar para a v2)

1. Entre em **https://dash.cloudflare.com** → **Workers & Pages** → abra o Worker `mangalist`.
2. Clique em **Edit code**.
3. Apague tudo, cole o conteúdo de `manga-proxy.js` e clique em **Deploy**.
4. Teste: abra no navegador
   `https://mangalist.victorbujnowski.workers.dev/cover?page=https%3A%2F%2Fkitsuneyako.com%2Fmanga%2Fnecromante-o-rei-da-calamidade%2F`
   Deve aparecer um JSON com `"image": "https://kitsuneyako.com/wp-content/uploads/..."`.

Não precisa mexer no `.env.local` nem refazer o deploy do app.

## Criar do zero

Publicar leva ~10 min e não precisa instalar nada.

## Passo a passo (pelo painel)

1. Crie uma conta grátis em **https://dash.cloudflare.com/sign-up** (só e-mail + senha, sem cartão).
2. No painel, vá em **Workers & Pages** → **Create application** → **Create Worker**.
3. Dê um nome, ex.: `manga-cover-proxy`, e clique em **Deploy** (ele cria um "Hello World").
4. Clique em **Edit code** (ou **Quick edit**).
5. **Apague tudo** que estiver no editor e **cole o conteúdo de** `manga-proxy.js` (este diretório).
6. Clique em **Deploy** (ou **Save and deploy**).
7. Copie a URL do Worker no topo — algo como:
   `https://manga-cover-proxy.SEU-USUARIO.workers.dev`

## O que fazer com a URL

A variável que o app usa precisa terminar em `/?url=`. Então, se sua URL for
`https://manga-cover-proxy.fulano.workers.dev`, o valor final é:

```
VITE_COVER_PROXY=https://manga-cover-proxy.fulano.workers.dev/?url=
```

Me mande a URL do Worker que eu coloco no `.env.local`, faço o rebuild e o
redeploy. (Ou, se preferir fazer você: adicione a linha acima no `.env.local`,
rode `npm run build` e `firebase deploy --only hosting`.)

## Testar o Worker (opcional)

Abra no navegador (deve devolver JSON do MangaDex):

```
https://SEU-WORKER.workers.dev/?url=https%3A%2F%2Fapi.mangadex.org%2Fmanga%3Ftitle%3Dberserk%26limit%3D1
```

## Segurança

O Worker só aceita repassar para `api.mangadex.org` (não é um proxy aberto) e
libera CORS para qualquer origem — então qualquer um poderia usá-lo para
buscar no MangaDex, mas não para mais nada. Para a busca de capa de um app
pessoal, está ótimo.
