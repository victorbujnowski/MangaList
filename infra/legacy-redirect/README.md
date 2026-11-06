# Redirecionamento do endereço antigo

O site `organizador-de-obras-d695d.web.app` era o endereço antigo do app. Ele agora só leva para **mangalist-app.web.app**, mantendo o caminho (links `/lista/<token>` continuam funcionando).

| Arquivo | Função |
|---|---|
| `public/index.html` + `redirect.js` | Redireciona qualquer rota para o mesmo caminho no endereço novo. |
| `public/sw.js` | Service worker de limpeza: quem tinha o app antigo instalado perde o cache velho e cai no redirecionamento. |
| `firebase.json` | Hosting do site antigo, tudo sem cache. |

**Por que não desativar o site:** o login com Google passa por `organizador-de-obras-d695d.firebaseapp.com/__/auth/...`, servido por esse mesmo hosting. Desativá-lo quebraria o login no app novo. As rotas `/__/` são reservadas do Firebase e não são afetadas pelo redirecionamento.

## Publicar

```bash
cd infra/legacy-redirect
firebase deploy --only hosting --project organizador-de-obras-d695d
```
