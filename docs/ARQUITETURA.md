# Arquitetura

Como o MangaList funciona por dentro e por que foi feito assim. Para instalar e rodar, veja o [README](../README.md).

## Visão geral

```
Navegador (PWA, React)
 ├─ Firebase Auth ............ login Google e e-mail/senha
 ├─ Firestore ................ obras de cada usuário, em tempo real
 ├─ AniList (GraphQL) ........ capas e títulos oficiais
 └─ Cover Worker (Cloudflare)
     ├─ /cover ............... capa lida na página da obra (Kitsune Yako)
     └─ /?url= ............... API do MangaDex com CORS (ID da obra no AniList)
```

Não há servidor próprio: o app é estático no Firebase Hosting, e o único código fora do navegador é o Worker ([`infra/cover-worker`](../infra/cover-worker)).

## Pastas

| Pasta | Conteúdo |
|---|---|
| `src/screens/` | Telas: estante (`Shelf`), login, conta, lista pública. |
| `src/components/` | Peças das telas: card, formulário da obra, cabeçalho, filtros. |
| `src/components/ui/` | Primitivos do design system: botão, campos, diálogo, aviso, capa, loader. |
| `src/hooks/` | Estado e efeitos: auth, obras, tema, recuperação de capas, share target. |
| `src/lib/` | Lógica sem React: parser de URL, capas, Firestore, compartilhamento (com testes). |
| `src/i18n/` | Traduções pt/en/es, tipadas: faltar uma chave é erro de compilação. |
| `src/styles/` | Tokens (cores, tipografia, espaçamento) e estilos globais. |
| `infra/` | Worker da Cloudflare e o redirecionamento do endereço antigo. |

## Fluxos principais

**Adicionar uma obra.** O usuário cola a URL do capítulo. `lib/urlParser.ts` reconhece o site e extrai título e capítulo. `lib/cover.ts` procura a capa (cadeia abaixo). O formulário grava no Firestore por `lib/db.ts`.

**Capas.** O MangaDex bloqueia a exibição das capas fora do site deles, então elas vêm de outras fontes, nesta ordem:

1. Página da obra no Kitsune Yako, pelo Worker: a mesma capa do site e o título com a grafia oficial.
2. Link do MangaDex: ID da obra → ID no AniList (`links.al`) → capa exata.
3. Título: AniList direto; senão, nomes alternativos em pt-br do MangaDex → ID no AniList; senão, tradução PT→EN.

Só aceita resultado cujo nome seja parecido com o buscado (`titleSimilarity` ≥ 0,6): é melhor ficar sem capa do que com a errada. Obras sem capa, ou com capa antiga do MangaDex, são completadas em segundo plano por `useCoverBackfill`, uma a cada 2,5 s, sem reordenar a estante.

**Compartilhar.** A lista pública é uma cópia reduzida (sem nota, gêneros nem anotações) em `publicLists/{token}`, atualizada sozinha quando a estante muda. O token é aleatório; quem não tem o link não acha a lista.

## Dados no Firestore

Os nomes dos campos não podem mudar sem migração: há dados de usuários gravados.

```ts
obras/{id}: {
  userId, titulo, tipo, site, siteKey,
  capituloAtual,          // string ("12.5" é válido)
  status,                 // 'lendo' | 'pausado' | 'concluído' | 'dropado'
  nota,                   // número 1–10 ou null
  generos: string[], capa, notasLivres, urlOrigem,
  criadoEm, atualizadoEm  // serverTimestamp; a estante ordena por atualizadoEm
}
users/{uid}: { shareToken }
publicLists/{token}: { ownerId, ownerName, obras: PublicObra[], updatedAt }
```

As regras em [`firestore.rules`](../firestore.rules) deixam cada usuário ler e escrever só as próprias obras. Listas públicas podem ser lidas por id, nunca listadas.

## Decisões

- **Design editorial:** papel `#F4F1EA`, tinta `#141414`, um único destaque `#D7263D`; Fraunces nos títulos, Instrument Sans no texto, JetBrains Mono nos números. Sem gradientes decorativos, emojis ou glassmorphism. Tokens em `src/styles/tokens.css`.
- **Erros visíveis:** falha ao salvar vira aviso e o formulário continua aberto; nada se perde em silêncio.
- **Troca de conta:** a lista é limpa antes de assinar a da nova conta.
- **Lista pública:** recusa passar de ~900 KB (limite de 1 MiB por documento do Firestore).
- **Conta em `#conta`:** o botão voltar do celular fecha a tela em vez de sair do app.
- **Diálogos com `<dialog>` nativo:** foco preso e Esc sem biblioteca.
- **Fontes self-hosted:** entram no cache do PWA e funcionam offline; nada é carregado do Google Fonts.
- **Loader:** o ícone animado aparece já no `index.html`, antes do JavaScript, e só depois de ~150 ms, para não piscar.
