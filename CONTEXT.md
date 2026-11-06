# MangaList: contexto do projeto

## O que é
PWA para guardar em que capítulo você está em cada mangá ou webtoon. O problema de fundo: sites de leitura somem e levam o progresso junto. Feito para compartilhar com amigos; cada usuário tem a própria lista privada.

## Stack
- React 18 + TypeScript estrito + Vite 5
- Firebase Auth (Google, e-mail/senha) e Firestore
- CSS Modules + tokens em `src/styles/tokens.css`
- Ícones: lucide-react. Fontes self-hosted via @fontsource
- `vite-plugin-pwa` (manifesto com share_target)
- Testes: Vitest (`src/**/*.test.ts`)

## Direção visual (v3)
Editorial de mangá. Papel `#F4F1EA`, tinta `#141414`, destaque único `#D7263D`. Serifa (Fraunces) nos títulos, Instrument Sans no texto, JetBrains Mono nos números. Evitar: gradientes decorativos, emojis, glassmorphism, cantos muito arredondados. Capas são as protagonistas; sem capa, o card mostra uma "capa tipográfica" com o título.

## Fluxo principal
Usuário cola a URL do capítulo → `lib/urlParser.ts` extrai título, capítulo e site → `lib/cover.ts` busca a capa no MangaDex → salva no Firestore (`lib/db.ts`) ou em memória (modo local).

## Modos
- **Firebase:** `.env.local` preenchido.
- **Local:** sem credenciais, ou `npm run dev:local` (`.env.demo` define `VITE_FORCE_LOCAL=true`). Usuário fictício e dados em memória.

## Dados no Firestore (não renomear campos)
```ts
obras/{id}: {
  userId, titulo, tipo, site, siteKey,
  capituloAtual,          // string
  status,                 // 'lendo' | 'pausado' | 'concluído' | 'dropado'
  nota,                   // número 1–10 ou null
  generos: string[], capa, notasLivres, urlOrigem,
  criadoEm, atualizadoEm  // serverTimestamp
}
users/{uid}: { shareToken }
publicLists/{token}: { ownerId, ownerName, obras: PublicObra[], updatedAt }  // cópia reduzida
```

## Decisões
- Erros de gravação viram toast e o formulário fica aberto (nada se perde em silêncio).
- Troca de conta limpa a lista antes de assinar a nova.
- Lista pública recusa passar de ~900 KB (limite de 1 MiB por documento).
- Área da conta usa `#conta` no histórico: o voltar do celular fecha a tela.
- Diálogos usam `<dialog>` nativo (foco preso e Esc de graça).

## Próximos passos possíveis
- PNGs 192/512 do ícone para alvos que não aceitam SVG
- Testes de componentes (Testing Library)
