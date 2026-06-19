# Plano Tecnico de Estabilizacao - Al Mare

## 1. Resumo da stack

- App principal localizada na raiz deste workspace `al-mare/`.
- Observacao importante: o caminho `projeto-salao/` citado no briefing nao existe neste checkout atual. Operacionalmente, a raiz do repositorio cumpre esse papel.
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion, Recharts.
- Backend web: App Router do Next.js com rotas em `app/api/**`.
- Dados e auth: Supabase (`@supabase/supabase-js`, `@supabase/ssr`).
- Persistencia complementar e integrações: Upstash Redis, Google Calendar, Resend, Nodemailer, AWS S3 / storage compativel.
- Banco/migracoes: `supabase/migrations/**`.

## 2. Mapa dos principais fluxos

### Autenticacao

- Interface e guarda: `components/AuthGuard.tsx`, `app/login/page.tsx`
- Clientes Supabase: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/supabase/config.ts`
- Operacoes administrativas e e-mail: `lib/server/supabaseAdmin.ts`, `app/api/auth/2fa/send/route.ts`, `app/api/auth/2fa/verify/route.ts`, `app/api/auth/password/reset/route.ts`
- Controle de acesso: `app/api/access/**`, `app/admin/acessos/page.tsx`

### Pacientes

- Tela principal: `app/pacientes/page.tsx`
- Estado e sincronizacao: `hooks/useClients.ts`
- API: `app/api/clients/route.ts`, `app/api/clients/records/route.ts`
- UI de cadastro e prontuario: `components/clientes/NewClientForm.tsx`, `components/clientes/AnamnesisWindow.tsx`, `components/clientes/ClientProfileTab.tsx`

### Anamnese / tricoscopia / diagnostico

- Aba clinica principal: `components/clientes/AnamneseCapilarTab.tsx`
- Evolucao visual: `components/clientes/PhotoEvolutionComparison.tsx`, `components/clientes/ImageGridComposer.tsx`
- Workflow e etapas: `lib/workflowStages.ts`, `components/clientes/AnamnesisWindow.tsx`

### Agendamentos

- UI e integracao Google Calendar: `components/clientes/ClientAgendaTab.tsx`
- Persistencia: `hooks/useClients.ts`, `app/api/clients/records/route.ts`
- Integracoes: `lib/server/googleCalendarAuth.ts`, `app/api/google-calendar/**`, `app/google-calendar-callback/page.tsx`

### Financeiro / homecare

- Dashboard macro: `components/DashboardWindow.tsx`
- Aba por cliente: `components/clientes/ClientFinanceiroTab.tsx`
- Dados financeiros e homecare saem principalmente de `hooks/useClients.ts`, `app/api/clients/route.ts`

### Documentos

- Janela interna: `components/DocumentsWindow.tsx`
- API e uploads: `app/api/company-documents/route.ts`, `app/api/upload/route.ts`, `app/api/upload/presigned/route.ts`, `app/api/upload/confirm/route.ts`

### Portal de pre-consulta

- Portal publico: `app/portal/[token]/page.tsx`
- API do portal: `app/api/portal/pre-consulta/route.ts`, `app/api/portal/session/route.ts`, `app/api/portal/link/route.ts`, `app/api/portal/media/[...publicId]/route.ts`
- Suporte no cliente: `lib/preConsultation.ts`, `components/clientes/ClientLinksTab.tsx`

### Personalizacao visual

- Provider e cache: `components/BrandingConfigProvider.tsx`, `lib/brandingConfig.ts`
- Janela de configuracao: `components/BrandingSettingsWindow.tsx`
- Consumo na UI: `components/BrandLogo.tsx`, `components/BrandMark.tsx`, `app/page.tsx`

### Workflow / etapas

- Definicoes e cache: `lib/workflowStages.ts`
- Orquestracao visual: `components/clientes/AnamnesisWindow.tsx`
- Jornada calculada: `hooks/useClients.ts`

## 3. Lista dos problemas encontrados por prioridade

### P0 - seguranca / critico

1. Credencial administrativa hardcoded em arquivo auxiliar descartavel.
   - Risco: exposicao de chave privilegiada fora de variaveis de ambiente.
   - Arquivos: `scratch/fix_rls.js`

2. Falta de contrato publico de variaveis de ambiente versionado.
   - Risco: repeticao de segredos locais, configuracao manual inconsistente e novos hardcodes.
   - Arquivos: ausencia de `.env.example`

3. Ausencia de varredura local simples para padroes perigosos.
   - Risco: reincidencia de tokens embutidos em scripts utilitarios.
   - Arquivos: ausencia de script dedicado em `scripts/`

4. `.gitignore` incompleto para alguns artefatos operacionais esperados no briefing.
   - Risco: commit acidental de ambientes locais e lixo de build.
   - Arquivos: `.gitignore`

### P1 - quebra de salvamento ou perda de dados

1. Persistencia da ficha de anamnese capilar dependia de `upsert` com `onConflict: "cliente_id"`, mas a migration de reestruturacao so cria o indice unico quando nao existem duplicatas ativas.
   - Risco: falha no salvamento em ambientes com duplicidade historica e comportamento inconsistente no reload.
   - Arquivos: `app/api/clients/records/route.ts`, `supabase/migrations/20260617153547_operational_restructure_foundation.sql`

2. Leitura do relacionamento `ficha_anamnese_capilar` escolhia o primeiro item retornado pela API, sem ordenar pela ficha mais recente.
   - Risco: sobrescrita visual por estado antigo ao reabrir modal, sincronizar lista ou recarregar a pagina.
   - Arquivos: `hooks/useClients.ts`, `app/pacientes/page.tsx`

3. Feedback de erro no formulario de anamnese era generico demais.
   - Risco: falha silenciosa para a operacao real do usuario.
   - Arquivos: `components/clientes/AnamneseCapilarTab.tsx`

### P2 - bugs visuais ou experiencia ruim

1. Nenhum bug visual novo foi atacado nesta tarefa.
   - Observacao: a validacao visual autenticada ainda depende de sessao local e auditoria por fluxo.

### P3 - limpeza, nomes antigos e organizacao

1. Divergencia entre documentacao/instrucao operacional e estrutura real do repositorio.
   - Risco: comandos rodados no caminho errado e manutencao confusa.
   - Arquivos: `package.json`, `scripts/migrate-projeto-salao-to-root.ps1`
   - Evidencia: o diretorio `projeto-salao/` nao existe neste checkout atual.

2. Pasta `docs/` inexistente antes desta tarefa.
   - Risco: ausencia de registro tecnico incremental.

## 4. Arquivos exatos envolvidos em cada problema

- `scratch/fix_rls.js`
- `.gitignore`
- `.env.example`
- `scripts/scan-secrets.js`
- `package.json`
- `scripts/migrate-projeto-salao-to-root.ps1`

## 5. Plano de correcao por etapas

### Etapa 0 - seguranca e secrets

- Remover ou neutralizar qualquer segredo hardcoded encontrado nos alvos auditados.
- Criar `.env.example` sem valores reais.
- Reforcar `.gitignore` para ambientes locais, `scratch/`, `dist/`, `logs/` e lixo de build.
- Adicionar script local de varredura de segredos.
- Validar com `npm run lint` e `npm run build`.

### Etapa 1 - diagnostico real de build e estrutura

- Confirmar `package.json` operacional na raiz.
- Confirmar inexistencia de `projeto-salao/package.json` e registrar o desvio.
- Rodar `npm run lint` e `npm run build` na raiz.
- Corrigir apenas erros claros de lint, tipo ou build, sem refatoracao estrutural ampla.
- Atualizar este plano com os resultados reais.

### Etapa 2 - persistencia critica de pacientes e prontuario

- Auditar `hooks/useClients.ts`, `app/api/clients/route.ts` e `app/api/clients/records/route.ts`.
- Validar criacao, edicao, sincronizacao e reconciliação de pacientes/agendamentos/homecare.
- Estabilizar especificamente o ciclo `AnamneseCapilarTab -> saveFichaAnamnese -> /api/clients/records -> ficha_anamnese_capilar`.

### Etapa 3 - auth, portal e links protegidos

- Revisar `components/AuthGuard.tsx`, `app/api/auth/**`, `app/api/portal/**`, `middleware.ts`.
- Validar expiracao de links, controle de acesso e mensagens de erro.

### Etapa 4 - storage, documentos e uploads

- Revisar `app/api/upload/**`, `app/api/company-documents/route.ts`, `lib/server/photoStorage*.ts`.
- Validar origem confiavel, metadata, confirmacao e limpeza.

### Etapa 5 - agenda, Google Calendar e operacao

- Revisar `components/clientes/ClientAgendaTab.tsx`, `app/api/google-calendar/**`, `lib/server/googleCalendarAuth.ts`.
- Validar criacao de eventos, callback, reautenticacao e persistencia de vinculos.

## 6. Criterios de aceite por etapa

### Etapa 0

- Nenhum segredo hardcoded confirmado permanece nos alvos auditados.
- `.env.example` existe e nao contem valores reais.
- `.gitignore` cobre os artefatos definidos.
- Existe um script local de varredura de segredos.
- `npm run lint` e `npm run build` concluem sem regressao.

### Etapa 1

- Estrutura real do projeto documentada.
- `package.json` operacional identificado.
- `npm run lint` e `npm run build` executados e resultado registrado.
- Nenhum erro claro de lint/build permanece sem classificacao.

### Etapa 2

- Criar, editar e sincronizar paciente sem erro.
- Registros clinicos nao somem apos refresh.
- APIs de pacientes retornam erros consistentes e seguros.

### Etapa 3

- Login, reset e 2FA completam fluxo esperado.
- Portal respeita tokens e acesso restrito.
- Nao ha rota sensivel sem guarda adequada.

### Etapa 4

- Upload, confirmacao e listagem funcionam sem 403 indevido.
- Documentos e fotos usam origem/permite correto.
- Falhas de storage retornam erro claro sem vazar detalhes internos.

### Etapa 5

- Agendamentos salvam e reabrem corretamente.
- Integracao Google Calendar conecta, cria evento e persiste vinculo.
- Falhas externas nao quebram o prontuario.

## 7. Resultado executado nesta rodada

### Etapa 0

- Concluida.
- Achado principal: havia credencial administrativa hardcoded em `scratch/fix_rls.js`.
- Acao aplicada:
  - remocao de `scratch/fix_rls.js`
  - criacao de `.env.example`
  - reforco de `.gitignore`
  - criacao de `scripts/scan-secrets.js`
  - adicao do script `npm run security:scan-secrets`
- Validacao executada na raiz do repositorio:
  - `npm run security:scan-secrets` -> sem padroes perigosos detectados nos alvos configurados
  - `npm run lint` -> sem erros
  - `npm run build` -> concluido com sucesso

### Etapa 1

- Concluida.
- Resultado estrutural:
  - `projeto-salao/` nao existe neste checkout atual
  - `package.json` operacional esta na raiz `al-mare/`
  - nao existe `projeto-salao/package.json`
- Resultado tecnico:
  - nenhum erro de lint, TypeScript ou build foi reproduzido na app real da raiz
  - nenhum ajuste adicional de codigo foi necessario nesta etapa
- Validacao executada na raiz do repositorio por ausencia de `projeto-salao/`:
  - `npm run lint` -> sem erros
  - `npm run build` -> concluido com sucesso

### Etapa 2

- Concluida em codigo, com validacao de lint/build.
- Causa raiz principal:
  - o backend salvava a ficha com `upsert(..., { onConflict: "cliente_id" })`, mas a migration operacional so cria o indice unico de `cliente_id` quando nao existem duplicatas ativas
  - o frontend usava o primeiro item retornado de `ficha_anamnese_capilar`, sem garantir que fosse o registro mais recente
  - a tela mostrava erro generico, dificultando diagnostico operacional
- Correcoes aplicadas:
  - `app/api/clients/records/route.ts`: troca de `upsert` por fluxo seguro `update -> insert`, atualizando fichas ativas do cliente antes de inserir uma nova quando necessario
  - `hooks/useClients.ts`: selecao da ficha ativa mais recente por `updated_at` e `created_at`
  - `components/clientes/AnamneseCapilarTab.tsx`: exibicao da mensagem real retornada pela API quando houver falha
  - `components/clientes/AnamneseCapilarTab.tsx`: protecao contra sobrescrita do formulario local quando o estado global do cliente e reidratado durante a digitacao
  - `supabase/migrations/20260618220930_dedupe_ficha_anamnese_capilar_active_rows.sql`: migration defensiva para consolidar duplicatas ativas sem apagar linhas historicas
- Validacao executada na raiz do repositorio:
  - `npm run lint` -> sem erros
  - `npm run build` -> concluido com sucesso
- Validacao funcional manual pendente:
  - abrir cliente autenticado, preencher tricoscopia, salvar, fechar/reabrir e recarregar para confirmar persistencia fim a fim no ambiente com sessao

### Etapa 3

- Concluida em codigo, com validacao de lint/build.
- Causa raiz principal:
  - os utilitarios de branding e workflow ainda carregavam assinatura legada por `organizationId`
  - quando `organizationId` chegava como `null`, as funcoes de cache e persistencia retornavam cedo e nao liam nem salvavam nada
  - a API `app/api/clinic-preferences/route.ts` ja estava correta em `user_id + preference_key`, entao o bloqueio estava no client-side
- Correcoes aplicadas:
  - `lib/brandingConfig.ts`: cache local agora usa chave estavel mesmo sem organizacao, com fallback de migracao para caches legados com prefixo
  - `lib/brandingConfig.ts`: leitura e escrita remota via `/api/clinic-preferences` nao dependem mais de `organizationId`
  - `components/BrandingConfigProvider.tsx`: passou a usar as funcoes sem `null` sentinela, mantendo leitura remota, escrita remota e localStorage ativos
  - `lib/workflowStages.ts`: cache local agora usa chave estavel e migra caches legados quando existirem
  - `lib/workflowStages.ts`: leitura e escrita remota do workflow nao dependem mais de `organizationId`
  - `components/clientes/AnamnesisWindow.tsx`: carregamento e salvamento das etapas passaram a usar o fluxo persistente por usuario
- Validacao executada na raiz do repositorio:
  - `npm run lint` -> sem erros
  - `npm run build` -> concluido com sucesso
- Validacao funcional manual pendente:
  - alterar branding, salvar e recarregar
  - alterar etapas, salvar, fechar/reabrir cliente e recarregar
