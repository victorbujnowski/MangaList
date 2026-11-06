# MangaList

Seu catálogo pessoal de mangás, webtoons, manhwas e manhuas. Cole a URL do capítulo e o app guarda título, capítulo e capa. PWA com React, TypeScript, Vite e Firebase.

**App no ar:** https://mangalist-app.web.app

## Funcionalidades

- Cole a URL do capítulo e o título e o capítulo são extraídos sozinhos (Sakura Mangás, Kitsune Yako, MangaDex)
- Capa buscada na API do MangaDex, com tradução PT→EN quando o título original não acha nada
- Botões −/+ para mudar de capítulo; a obra atualizada sobe para o topo
- Status (Lendo, Pausado, Concluído, Dropado), filtros por tipo e site, busca sem acento
- Estante compartilhável por link, só leitura (nota, gêneros e anotações continuam privados)
- Login com Google ou e-mail/senha; dados sincronizados em tempo real no Firestore
- Interface em português, inglês e espanhol; tema claro e escuro
- PWA instalável com Share Target: compartilhe o link do capítulo direto do navegador do celular

## Rodando

```bash
npm install
npm run dev          # com Firebase (usa .env.local)
npm run dev:local    # modo local: dados em memória, ignora o .env.local
```

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run dev:local` | Mesmo servidor em modo local, para testar a interface sem tocar nos dados reais |
| `npm test` | Testes (Vitest): parser de URL, payload, compartilhamento, busca de capa, i18n |
| `npm run typecheck` | Checagem de tipos (TypeScript estrito) |
| `npm run build` | Typecheck + build de produção em `dist/` |

### Modos de execução

| Modo | Quando | Comportamento |
|---|---|---|
| Firebase | `.env.local` preenchido | Login + Firestore em tempo real |
| Local | sem `.env.local`, ou `npm run dev:local` | Sem login, dados em memória que somem ao recarregar |

## Configurar o Firebase

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. Em **Authentication > Sign-in method**, ative **Google** e **E-mail/senha**.
3. Crie o banco em **Firestore Database** (modo produção).
4. Copie `.env.example` para `.env.local` e preencha com as credenciais do app web.
5. Publique regras e índices:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

As regras (`firestore.rules`) deixam cada usuário ver só as próprias obras. O índice composto (`userId` + `atualizadoEm`) é obrigatório para a lista carregar.

## Deploy (Firebase Hosting)

```bash
npm run build
firebase deploy
```

O `firebase.json` configura SPA, cache imutável dos assets e cabeçalhos de segurança (CSP, HSTS, X-Frame-Options).

## Busca de capa (proxy CORS)

A API do MangaDex só libera CORS para `localhost`. Em produção, `src/lib/cover.ts` cai num proxy quando a chamada direta falha. Defina `VITE_COVER_PROXY` com a URL de um Cloudflare Worker (código e passo a passo em [`cloudflare-worker/`](cloudflare-worker/)). Sem ele, o app usa um proxy público de reserva, mais lento.

## Design

Direção **editorial de mangá**: papel e tinta, um único destaque vermelho, serifa nos títulos (Fraunces), sans no texto (Instrument Sans) e mono nos números (JetBrains Mono). As fontes são self-hosted e entram no cache do PWA. Os tokens ficam em [`src/styles/tokens.css`](src/styles/tokens.css); nada de cor ou espaçamento solto nos componentes.

## Estrutura

```
src/
  components/
    ui/               Button, Field, Dialog (<dialog> nativo), Toast, Cover
    Header, LibraryControls, ObraCard, ObraModal, Login, UserArea, PublicList, …
  hooks/              useAuth, useObras, useTheme, useShareTarget, useHashView
  lib/                urlParser, cover, db, share, firebase, constants (+ testes)
  i18n/               translations (pt/en/es, tipadas), I18nContext
  styles/             tokens.css, global.css
  types.ts            Obra, ObraDraft, PublicListDoc, AppUser
public/theme-init.js  aplica o tema antes do primeiro paint
cloudflare-worker/    proxy CORS opcional para a busca de capa
```

## Sites suportados

| Site | Tipo | Exemplo |
|---|---|---|
| Sakura Mangás | Mangá | `/obras/chainsaw-man/97/` ou `/manga/<slug>/capitulo-<n>` |
| Kitsune Yako | Webtoon | `/necromante-o-rei-da-calamidade-capitulo-273/` ou `/serie/<slug>/<n>/` |
| MangaDex | Mangá | `/title/<uuid>/<slug>` (`/chapter/<uuid>` pede o título) |
