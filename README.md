<div align="center">

<img src="public/icon.svg" width="88" alt="MangaList" />

# MangaList

**Todas as suas obras catalogadas em um só lugar.**

Catálogo pessoal de mangás, webtoons, manhwas e manhuas: cole o link do capítulo
e o app guarda título, capítulo e capa. Se o site de leitura sumir, seu progresso fica.

[**Abrir o app**](https://mangalist-app.web.app) · [Arquitetura](docs/ARQUITETURA.md)

![React](https://img.shields.io/badge/React-18-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-ffca28?logo=firebase&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-instalável-5a0fc8?logo=pwa&logoColor=white)

</div>

<!-- Capturas: salve as imagens em docs/screenshots/ e descomente.
<p align="center">
  <img src="docs/screenshots/estante.png" width="72%" alt="Estante" />
  <img src="docs/screenshots/celular.png" width="22%" alt="No celular" />
</p>
-->

## Funcionalidades

- **Adicionar colando o link.** Título, capítulo e site são extraídos da URL do capítulo.
- **Capa automática.** Vem da página da obra, do AniList ou pelo nome em português, sem nenhum clique. Obras antigas sem capa são completadas sozinhas.
- **Um toque por capítulo.** Botões − e + em cada card; a obra atualizada sobe para o topo.
- **Organização.** Status (lendo, pausado, concluído, dropado), filtros por tipo e site, busca que ignora acentos.
- **Estante compartilhável.** Link só leitura para amigos; nota, gêneros e anotações continuam privados.
- **Conta e sincronização.** Login com Google ou e-mail; tudo salvo no Firestore em tempo real.
- **Feito para o celular.** PWA instalável, funciona offline e recebe links pelo "Compartilhar" do navegador.
- **Português, inglês e espanhol**, tema claro e escuro.

### Sites suportados

| Site | Tipo | Exemplo de link |
|---|---|---|
| Sakura Mangás | Mangá | `sakuramangas.org/obras/chainsaw-man/97/` |
| Kitsune Yako | Webtoon | `kitsuneyako.com/necromante-o-rei-da-calamidade-capitulo-273/` |
| MangaDex | Mangá | `mangadex.org/title/<id>/one-piece` |

Obras de outros sites podem ser cadastradas à mão.

## Stack

| Camada | Tecnologia |
|---|---|
| Interface | React 18, TypeScript estrito, CSS Modules com design tokens, ícones Lucide |
| Build | Vite 5, `vite-plugin-pwa` (Workbox) |
| Dados | Firebase Auth e Cloud Firestore |
| Capas | AniList GraphQL e um Cloudflare Worker ([`infra/cover-worker`](infra/cover-worker)) |
| Testes | Vitest |
| Hospedagem | Firebase Hosting |

## Rodando localmente

Pré-requisito: **Node.js 20+**.

```bash
git clone https://github.com/victorbujnowski/MangaList.git
cd MangaList
npm install
npm run dev:local
```

`dev:local` abre o app em **modo local**: sem login, com os dados só na memória. Serve para mexer na interface sem configurar nada. Para usar contas e salvar de verdade, configure o Firebase (abaixo) e rode `npm run dev`.

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com Firebase (lê o `.env.local`) |
| `npm run dev:local` | Servidor de desenvolvimento em modo local |
| `npm test` | Testes (parser de URL, capas, dados, compartilhamento, traduções) |
| `npm run typecheck` | Checagem de tipos |
| `npm run build` | Typecheck e build de produção em `dist/` |

## Configuração

### Firebase

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. Em **Authentication → Sign-in method**, ative **Google** e **E-mail/senha**.
3. Crie o banco em **Firestore Database** (modo produção).
4. Copie `.env.example` para `.env.local` e preencha com as credenciais do app web.
5. Publique as regras de segurança e o índice:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

### Capas

A busca de capa funciona sem configuração para a maioria das obras (AniList). Para ler capas direto do Kitsune Yako e usar links do MangaDex, publique o Worker grátis da Cloudflare e defina `VITE_COVER_PROXY` no `.env.local`. Passo a passo em [`infra/cover-worker`](infra/cover-worker).

## Deploy

```bash
npm run build
firebase deploy --only hosting:mangalist-app
```

O `firebase.json` configura SPA, cache imutável dos assets e cabeçalhos de segurança (CSP, HSTS).

## Estrutura

```
src/
  screens/         telas: estante, login, conta, lista pública
  components/      card, formulário da obra, cabeçalho, filtros
  components/ui/   design system: botão, campos, diálogo, aviso, capa, loader
  hooks/           auth, obras, tema, recuperação de capas, share target
  lib/             parser de URL, capas, Firestore, compartilhamento (+ testes)
  i18n/            traduções pt/en/es
  styles/          tokens e estilos globais
infra/
  cover-worker/    Cloudflare Worker das capas
  legacy-redirect/ redirecionamento do endereço antigo
docs/              arquitetura e decisões
```

Detalhes de fluxos, dados e decisões em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Créditos

Capas e títulos: [AniList](https://anilist.co) e os próprios sites de leitura. Identificação de obras: [MangaDex](https://mangadex.org). O MangaList não hospeda nenhum capítulo; ele só guarda onde você parou.
