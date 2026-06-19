# Plano da Ficha Capilar 360

## Objetivo

Criar uma evolucao segura da anamnese capilar do Al Mare, adicionando a **Ficha Capilar 360** e o **Assistente de Triagem Capilar** sem apagar campos antigos, sem mudar autenticacao e sem alterar banco.

## Estrategia de compatibilidade

- A tabela continua sendo `ficha_anamnese_capilar`.
- Os novos dados continuam dentro da coluna JSONB `dados`.
- O formato antigo permanece valido.
- O novo bloco usa `dados.schemaVersion = 2` apenas quando campos da Ficha Capilar 360 sao editados.
- A nova estrutura fica em `dados.capilar360`.
- Nenhum campo antigo foi removido.

## Suporte de banco adicionado

Migration criada:

- `supabase/migrations/20260619214421_capillary_360_schema_support.sql`

Ela adiciona metadados opcionais em `ficha_anamnese_capilar`:

- `schema_version`
- `capilar360_status`
- `capilar360_attention_level`
- `capilar360_red_flags_count`
- `capilar360_pending_questions_count`
- `capilar360_summary`
- `capilar360_last_triage_at`
- `capilar360_reviewed_at`
- `capilar360_reviewed_by`
- `capilar360_metadata`

Tambem cria a tabela `ficha_capilar_360_photo_links` para vincular fotos da galeria a tricoscopia, evolucao, comparativos e resultados, com RLS por `user_id`, validacao de cliente/foto e indices para consulta.

## Estrutura adicionada

### `capilar360.triagemQueixa`

- Queixas: queda, quebra, oleosidade, descamacao/caspa, coceira, ardencia, dor, falhas, afinamento, crescimento lento, dano quimico e manutencao preventiva.
- Inicio da queixa.
- Evolucao.
- Momento em que percebe mais.
- Queda pela raiz ou quebra no comprimento.
- Observacoes.

### `capilar360.fatoresRecentes`

- Pos-parto.
- Estresse.
- Febre/infeccao.
- Cirurgia.
- Dieta restritiva.
- Perda de peso.
- Medicamentos.
- Alteracoes hormonais.
- Anemia/tireoide/SOP.
- Detalhes, medicamentos e historico hormonal.

### `capilar360.mapaCouroCabeludo`

Regioes:

- Frontal.
- Topo.
- Coroa.
- Lateral direita.
- Lateral esquerda.
- Nuca.

Achados por regiao:

- Oleosidade.
- Descamacao.
- Vermelhidao.
- Coceira.
- Ardencia.
- Dor.
- Falhas.
- Afinamento.
- Baixa densidade.
- Residuos.
- Feridas.
- Crostas.

### `capilar360.historicoQuimico`

- Coloracao, mechas, descoloracao, progressiva, botox, relaxamento, hene e selagem.
- Data do ultimo procedimento.
- Uso frequente de calor.
- Corte quimico.
- Elasticidade.
- Porosidade.
- Quebra apos quimica.
- Observacoes tecnicas.

### `capilar360.rotinaCapilar`

- Frequencia de lavagem.
- Produtos usados.
- Condicionador/mascara na raiz.
- Tonico.
- Oleo.
- Finalizador.
- Chapinha/secador.
- Dorme/prende molhado.
- Bone/capacete.
- Penteados apertados.
- Cronograma.

### `capilar360.registrosTricoscopia`

- Data.
- Regiao.
- Imagem vinculada por ID da galeria.
- Observacoes do couro.
- Observacoes dos fios.
- Densidade visual.
- Residuos/descamacao.
- Comparacao anterior.

### `capilar360.planoCuidado`

- Objetivo principal.
- Protocolo sugerido.
- Numero de sessoes.
- Frequencia.
- Cuidados em casa.
- Home care.
- Cuidados a evitar.
- Retorno sugerido.
- Observacoes da profissional.

### `capilar360.evolucaoSessoes`

- Data.
- Sessao.
- Procedimento.
- Resposta da cliente.
- Produtos usados.
- Fotos vinculadas por IDs da galeria.
- Orientacao em casa.
- Proximo passo.

### `capilar360.consentimentos`

- Fotos para uso interno.
- Uso de imagem em redes.
- Antes/depois sem rosto.
- Recebeu home care.
- Ciente de que resultados variam.
- Profissional revisou.

## Assistente de Triagem Capilar

Arquivos:

- `lib/capillaryTriage/types.ts`
- `lib/capillaryTriage/knowledge.ts`
- `lib/capillaryTriage/questions.ts`
- `lib/capillaryTriage/redFlags.ts`
- `lib/capillaryTriage/rules.ts`
- `lib/capillaryTriage/analyze.ts`
- `lib/capillaryTriage/index.ts`

Retorno de `analyzeCapillaryTriage(data)`:

- Resumo automatico da queixa.
- Nivel de atencao: baixo, moderado ou alto.
- Padroes para revisao profissional.
- Red flags.
- Perguntas pendentes.
- Proximos passos sugeridos.
- Disclaimer fixo.

## Regras de seguranca de linguagem

O assistente deve usar linguagem de apoio:

- "sinais compativeis com..."
- "padrao que merece atencao..."
- "hipotese para revisao profissional..."
- "considerar avaliacao dermatologica se..."

O assistente nao deve:

- Fechar diagnostico.
- Prescrever medicamentos.
- Prometer resultado.
- Substituir avaliacao medica.
- Expor dados sensiveis desnecessarios.

## UI planejada

- Nova secao logo apos "Queixa principal".
- Cards acolhedores e premium, sem visual hospitalar pesado.
- Resumo do assistente no topo.
- Blocos editaveis para triagem, fatores recentes, mapa do couro, historico quimico, rotina, tricoscopia, plano, evolucao e consentimentos.
- Galeria com rotulos mais alinhados ao acompanhamento: "Antes do protocolo", "Resultado parcial/final" e "Tricoscopia / comparativo".
- Seletores de fotos da galeria para tricoscopia e evolucao.

## Criterios de aceite

- Ficha antiga continua abrindo.
- Novos campos salvam no mesmo fluxo de `onSave(nextData)`.
- Ao editar a Ficha Capilar 360, `schemaVersion` passa para `2`.
- Campos de tricoscopia/evolucao podem ser adicionados e removidos.
- Assistente atualiza conforme os campos mudam.
- Red flags aparecem sem diagnostico fechado.
- Galeria segue aceitando categorias antigas.
- Migration local cria suporte de banco sem remover dados existentes.
- API valida `capilar360` com schema tolerante e calcula metadados de triagem quando as novas colunas existem.
- `npm run lint` passa.
- `npm run build` passa.

## Proximos incrementos recomendados

- Incluir resumo da Ficha Capilar 360 no PDF/print.
- Aplicar a migration no Supabase depois de revisar em staging/local.
- Criar endpoints dedicados para persistir `ficha_capilar_360_photo_links` quando o fluxo exigir busca relacional fora do JSON.
- Criar testes unitarios para `analyzeCapillaryTriage`.
- Adicionar templates rapidos de home care por objetivo.
