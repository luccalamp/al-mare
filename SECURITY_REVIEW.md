# Security Review

## Resumo executivo

Esta revisao defensiva cobriu apenas o workspace local do projeto. A stack principal e Next.js 14 App Router, React 18, Supabase Auth/Database, rotas API server-side, S3/R2 para midia, Google Calendar OAuth e painel administrativo protegido por token.

Foram corrigidos riscos reais em autenticacao, origem de requisicoes, tokens em URL/logs, uploads diretos, redirects confiaveis, armazenamento de token administrativo no browser e validacao de configuracoes visuais. O build de producao passou apos as alteracoes.

Pontos sensiveis mapeados:

- Autenticacao: `AuthGuard`, Supabase Auth, 2FA por e-mail, reset/criacao de senha, callback OAuth.
- Banco de dados: chamadas Supabase server-side com service role em rotas API e helpers de recuperacao.
- APIs: rotas privadas por sessao, rotas publicas do portal, rotas admin e rotas internas de cron.
- Uploads: upload direto e presigned URL para S3, proxy privado de midia e galeria do portal.
- Painel admin: token administrativo, cookie httpOnly e operacoes de aprovacao/restore/archive.
- Variaveis de ambiente: Supabase, Resend, Google, S3, cron e token administrativo.

## Vulnerabilidades encontradas e corrigidas

### 1. Mutacoes de API sem validacao central de origem

- Arquivo afetado: `middleware.ts`
- Trecho afetado: rotas `/api/*` com metodos `POST`, `PUT`, `PATCH`, `DELETE`
- Severidade: alta
- Risco: CORS era anunciado, mas requisicoes mutaveis nao eram rejeitadas por `Origin`/`Referer` suspeito.
- Impacto pratico: uma pagina externa poderia tentar acionar endpoints usando cookies do navegador, especialmente em rotas autenticadas por sessao.
- Correcao aplicada: o middleware agora bloqueia mutacoes cross-site, trata `OPTIONS`, define headers CORS consistentes e preserva chamadas server-to-server sem `Origin`.
- Arquivos alterados: `middleware.ts`

### 2. Payload de 2FA sem assinatura criptografica

- Arquivos afetados: `app/api/auth/2fa/send/route.ts`, `app/api/auth/2fa/verify/route.ts`
- Trecho afetado: cookie `2fa_payload`
- Severidade: alta
- Risco: o cookie continha dados em base64 sem HMAC.
- Impacto pratico: payload adulterado poderia tentar contornar a verificacao do desafio em cenarios de manipulacao de cookie/local browser.
- Correcao aplicada: criado helper de assinatura HMAC para cookies sensiveis e verificacao com comparacao em tempo constante.
- Arquivo novo: `lib/server/signedCookie.ts`

### 3. Token do portal exposto em URL de imagem

- Arquivos afetados: `app/api/portal/session/route.ts`, `app/api/portal/media/[...publicId]/route.ts`
- Trecho afetado: URLs `/api/portal/media/... ?token=...`
- Severidade: alta
- Risco: token do portal aparecia em query string.
- Impacto pratico: token poderia ficar em historico, logs, analytics, screenshots ou referer.
- Correcao aplicada: imagens do portal agora usam a sessao httpOnly `portal_session_token`; a query continua aceita apenas como compatibilidade com links antigos.

### 4. Links sensiveis montados pela origem da requisicao

- Arquivos afetados: `app/api/auth/password/reset/route.ts`, `app/api/access/request/route.ts`, `app/api/access/requests/route.ts`, `app/auth/callback/route.ts`, `lib/server/googleCalendarAuth.ts`, `middleware.ts`
- Trecho afetado: `new URL(..., request.url)` em links de senha, OAuth e redirects internos
- Severidade: alta
- Risco: dependencia do `Host` recebido para montar links sensiveis.
- Impacto pratico: em ambiente mal configurado, um header de host manipulado poderia influenciar redirects ou links enviados por e-mail.
- Correcao aplicada: criado helper de origem confiavel e redirects agora usam origem configurada por env ou fallback de producao.
- Arquivo novo: `lib/server/trustedOrigin.ts`

### 5. Confirmacao de upload confiava em `objectKey` e `proxyUrl` do cliente

- Arquivos afetados: `app/api/upload/presigned/route.ts`, `app/api/upload/confirm/route.ts`, `lib/server/s3.ts`
- Trecho afetado: confirmacao de upload direto para S3
- Severidade: media
- Risco: a confirmacao aceitava caminhos e URL enviados pelo cliente.
- Impacto pratico: usuario autenticado poderia registrar referencia para objeto fora do prefixo esperado do paciente se conhecesse um caminho valido.
- Correcao aplicada: o servidor valida o MIME antes de assinar upload, confirma que o `objectKey` pertence ao prefixo hash do paciente e recalcula a `proxyUrl`.

### 6. Token administrativo persistido em `sessionStorage`

- Arquivo afetado: `lib/adminApi.ts`
- Trecho afetado: `salao-admin-operations-token-v1`
- Severidade: media
- Risco: token admin ficava persistido em armazenamento acessivel por JavaScript.
- Impacto pratico: qualquer XSS futuro teria acesso direto ao token ate o fim da sessao do navegador.
- Correcao aplicada: token fica apenas em memoria da aba e o servidor recebe uma chamada para emitir/limpar cookie httpOnly.

### 7. Comparacoes manuais de segredos administrativos/cron

- Arquivos afetados: `lib/server/requestGuards.ts`, `app/api/internal/cleanup/audit/route.ts`, `app/api/internal/cleanup/quarantine/route.ts`
- Trecho afetado: comparacoes diretas de token/segredo
- Severidade: media
- Risco: comparacao direta de segredo pode vazar informacao por tempo em cenarios especificos.
- Impacto pratico: melhora de hardening para endpoints administrativos e de cron.
- Correcao aplicada: comparacao em tempo constante e reutilizacao do guard central.

### 8. Logs e respostas com informacao sensivel

- Arquivos afetados: `app/api/portal/pre-consulta/route.ts`, `lib/googleCalendar.ts`, `app/api/auth/2fa/send/route.ts`, `app/api/auth/password/reset/route.ts`
- Trecho afetado: logs de token/cookies/OAuth e mensagens de configuracao interna
- Severidade: media
- Risco: tokens, cookies ou detalhes internos poderiam aparecer em console/logs ou respostas de API.
- Impacto pratico: vazamento operacional em debugging ou logs de plataforma.
- Correcao aplicada: removidos logs sensiveis e respostas publicas trocadas por mensagens genericas.

### 9. CSS injection por configuracao visual

- Arquivos afetados: `lib/brandingConfig.ts`, `components/BrandingConfigProvider.tsx`
- Trecho afetado: valores usados em `dangerouslySetInnerHTML` para CSS variables
- Severidade: media
- Risco: valores de cor vindos do banco/cache poderiam ser interpolados em CSS sem validacao.
- Impacto pratico: possibilidade de CSS injection caso uma preferencia fosse gravada com valor malicioso.
- Correcao aplicada: cores, fundo, logo e opacidade agora passam por validacao/normalizacao antes de entrar no provider.

### 10. Payload de preferencias sem limite de tamanho/chave

- Arquivo afetado: `app/api/clinic-preferences/route.ts`
- Trecho afetado: `key` e `payload`
- Severidade: baixa
- Risco: chaves arbitrarias e payloads grandes demais.
- Impacto pratico: consumo desnecessario de banco e dados dificeis de governar.
- Correcao aplicada: chave limitada a caracteres esperados e payload limitado a 50 KB.

## Dependencias com risco pendente

Nao atualizei pacotes porque a instrucao desta revisao proibiu acesso a dominios externos. A verificacao local mostrou versoes instaladas que devem ser atualizadas quando houver janela para acessar o registry e rodar `npm install`/`npm audit`.

- `next@14.2.35`: existem advisories recentes para Next.js; upgrade precisa ser planejado e testado, provavelmente para linha maior.
- `dompurify@3.4.0`: atualizar para versao corrigida.
- `nodemailer@8.0.7`: atualizar para versao corrigida.
- `supabase@2.92.0`: CLI/dev dependency com advisory transitivo em `tar`; atualizar.
- `@supabase/realtime-js -> ws@8.20.0`: atualizar cadeia Supabase quando disponivel.
- `postcss`: ha duas versoes locais, incluindo transitive em Next; atualizar junto do Next e toolchain.

## Arquivos alterados

- `middleware.ts`
- `app/auth/callback/route.ts`
- `app/api/access/request/route.ts`
- `app/api/access/requests/route.ts`
- `app/api/auth/2fa/send/route.ts`
- `app/api/auth/2fa/verify/route.ts`
- `app/api/auth/password/reset/route.ts`
- `app/api/clinic-preferences/route.ts`
- `app/api/google-calendar/callback/route.ts`
- `app/api/internal/cleanup/audit/route.ts`
- `app/api/internal/cleanup/quarantine/route.ts`
- `app/api/portal/media/[...publicId]/route.ts`
- `app/api/portal/pre-consulta/route.ts`
- `app/api/portal/session/route.ts`
- `app/api/upload/confirm/route.ts`
- `app/api/upload/presigned/route.ts`
- `lib/adminApi.ts`
- `lib/brandingConfig.ts`
- `lib/googleCalendar.ts`
- `lib/server/googleCalendarAuth.ts`
- `lib/server/requestGuards.ts`
- `lib/server/s3.ts`
- `lib/server/signedCookie.ts`
- `lib/server/trustedOrigin.ts`

## Verificacao executada

- `npm run build`: passou.
- `git diff --check`: passou, apenas avisos normais de CRLF no Windows.
- `npm ls next dompurify nodemailer supabase postcss ws glob --depth=2`: executado localmente para mapear versoes sensiveis.

## Proximos passos recomendados

1. Rodar `npm audit` e atualizar dependencias quando acesso ao registry estiver liberado.
2. Criar `AUTH_COOKIE_SIGNING_SECRET` forte em producao para assinar cookies sensiveis sem depender de fallback.
3. Configurar explicitamente `NEXT_PUBLIC_BASE_URL` ou `BASE_URL` com a URL final do app.
4. Revisar policies/RLS no Supabase pelo MCP quando a revisao puder incluir o projeto remoto.
5. Considerar testes automatizados para 2FA, reset de senha, portal media e upload presigned.
