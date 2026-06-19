export type HelpGuideItem = {
  id: string;
  title: string;
  purpose: string;
  whenToUse: string;
  example: string;
};

export type HelpGuideSection = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  items: readonly HelpGuideItem[];
};

export type HelpGuideScenario = {
  id: string;
  title: string;
  summary: string;
  steps: readonly string[];
};

export const HELP_GUIDE_PRINCIPLES = [
  {
    title: "Comece pela home",
    description: "A tela inicial agora mostra o que pede acao no dia: agenda, fichas pendentes, homecare em aberto e prontuarios recentes.",
  },
  {
    title: "Atenda por etapas",
    description: "Cada prontuario foi dividido em blocos para evitar retrabalho: dados, avaliacao, agenda, evolucao e pos-venda.",
  },
  {
    title: "Feche o ciclo",
    description: "Depois do atendimento, registre orientacoes, retorno, homecare e materiais do portal para manter o acompanhamento vivo.",
  },
] as const;

export const HELP_GUIDE_SECTIONS: readonly HelpGuideSection[] = [
  {
    id: "workspace",
    kicker: "Visao geral",
    title: "Home da clinica",
    description: "Essa e a mesa de trabalho principal. Tudo comeca aqui: ver prioridades reais do dia, abrir modulos centrais e chegar direto na paciente certa.",
    items: [
      {
        id: "workspace-home",
        title: "Workspace clinico",
        purpose: "Mostra o panorama da operacao com cards realmente uteis para agenda, pendencias, fichas e pos-venda.",
        whenToUse: "Use ao iniciar o expediente ou sempre que quiser decidir qual paciente merece atencao primeiro.",
        example: "Voce abre a home para ver quem atende hoje, quais fichas ainda faltam e qual homecare precisa de acerto.",
      },
      {
        id: "workspace-search",
        title: "Busca principal",
        purpose: "Encontra paciente, protocolo ou prontuario sem precisar navegar manualmente pela grade.",
        whenToUse: "Use quando ja souber parte do nome, do protocolo ou quiser chegar direto em um caso especifico.",
        example: "Digite o nome da paciente para abrir o prontuario sem passar por todas as pastas na tela.",
      },
      {
        id: "workspace-filters",
        title: "Filtros de jornada",
        purpose: "Separam as pacientes por estagio do fluxo: triagem, aguardando resposta, avaliacao, retorno ou acompanhamento.",
        whenToUse: "Use quando quiser organizar o dia por prioridade operacional e nao so por ordem alfabetica.",
        example: "Antes de enviar follow-up, filtre por 'Sem retorno' para achar quem precisa de contato.",
      },
      {
        id: "workspace-new-client",
        title: "Novo paciente",
        purpose: "Cria um prontuario completo para iniciar o atendimento sem depender de anotacoes soltas.",
        whenToUse: "Use sempre que entrar uma nova paciente na clinica ou quando um cadastro precisar nascer do zero.",
        example: "Uma nova avaliacao foi fechada por WhatsApp. Voce cadastra a paciente e ja abre o prontuario para preparar a consulta.",
      },
      {
        id: "workspace-dashboard",
        title: "Dashboard financeiro",
        purpose: "Concentra visao operacional, receita, comportamento da base e leitura do caixa da clinica.",
        whenToUse: "Use para leitura de resultado, checagem de performance ou conferencia de movimentacao por periodo.",
        example: "No fechamento da semana, voce abre o dashboard para comparar receita, recorrencia de atendimentos e homecare.",
      },
      {
        id: "workspace-documents",
        title: "Central de arquivos",
        purpose: "Guarda documentos e materiais em um acervo por pastas, com contexto claro para a equipe.",
        whenToUse: "Use quando precisar buscar um arquivo, registrar instrucoes de uma pasta ou enviar novos documentos para um destino definido.",
        example: "Antes de subir um contrato, voce seleciona a pasta correta, valida o texto principal e envia o arquivo sem risco de cair no lugar errado.",
      },
      {
        id: "workspace-branding",
        title: "Personalizar marca e textos",
        purpose: "Ajusta nome da clinica, textos principais e elementos visuais usados nas telas e documentos.",
        whenToUse: "Use quando a clinica mudar assinatura, comunicacao, rotulos ou identidade apresentada para paciente e equipe.",
        example: "A profissional quer trocar o texto da pre-consulta e revisar o nome mostrado nas telas. Essa configuracao fica aqui.",
      },
    ],
  },
  {
    id: "prontuario",
    kicker: "Fluxo do atendimento",
    title: "Prontuario da paciente",
    description: "O prontuario e o centro clinico do sistema. Cada aba representa uma etapa do atendimento para registrar o caso e acompanhar a evolucao sem perder contexto.",
    items: [
      {
        id: "tab-perfil",
        title: "Perfil",
        purpose: "Concentra dados cadastrais, contatos, origem da paciente e informacoes-base do relacionamento.",
        whenToUse: "Use para revisar ou atualizar os dados principais antes do atendimento e antes de qualquer comunicacao.",
        example: "Antes de enviar um retorno, voce confere WhatsApp, cidade, observacoes internas e origem da paciente.",
      },
      {
        id: "tab-agenda",
        title: "Agenda",
        purpose: "Registra horarios da paciente, historico de agendamentos e integracao com o Google Calendar.",
        whenToUse: "Use para criar, confirmar e revisar sessoes futuras ou passadas ligadas ao tratamento.",
        example: "Ao fechar um retorno de terapia, voce agenda a sessao e envia o evento para o Google Calendar.",
      },
      {
        id: "tab-links",
        title: "Links",
        purpose: "Controla pre-consulta e acessos compartilhaveis, como portal e materiais que a paciente pode abrir fora da clinica.",
        whenToUse: "Use quando precisar enviar um link ativo, reabrir acesso ou conferir se a paciente ja respondeu uma etapa remota.",
        example: "Antes da consulta, voce ativa a pre-consulta para que a paciente envie informacoes antes de chegar.",
      },
      {
        id: "tab-anamnese",
        title: "Ficha",
        purpose: "Guarda a anamnese capilar estruturada, com historico clinico e respostas essenciais do caso.",
        whenToUse: "Use na primeira avaliacao ou quando um quadro clinico exigir atualizacao formal das respostas.",
        example: "Na consulta inicial, a profissional registra habitos, historico e sinais clinicos em vez de deixar isso disperso em notas.",
      },
      {
        id: "tab-diagnostico",
        title: "Saude",
        purpose: "Registra diagnostico capilar, resultados de testes e leitura tecnica do estado atual do fio e couro cabeludo.",
        whenToUse: "Use quando a profissional precisar sustentar a conduta com avaliacao tecnica e comparar evolucao depois.",
        example: "Apos o teste de mecha, voce registra porosidade, elasticidade e observacoes para orientar o tratamento.",
      },
      {
        id: "tab-procedimentos",
        title: "Procedimentos",
        purpose: "Documenta sessoes, protocolos executados, formulas, orcamento e decisoes tecnicas do atendimento.",
        whenToUse: "Use durante ou logo apos o procedimento para manter o historico fiel ao que foi realizado.",
        example: "Depois da sessao, voce salva tecnica usada, etapas da terapia e valores combinados.",
      },
      {
        id: "tab-evolucao",
        title: "Evolucao",
        purpose: "Acompanha plano terapeutico e resposta da paciente ao longo das semanas.",
        whenToUse: "Use em retornos, reavaliacoes e momentos em que for preciso comparar progresso e aderencia.",
        example: "Na quarta semana, voce revisa a evolucao para decidir se mantem a mesma linha de conduta.",
      },
      {
        id: "tab-financeiro",
        title: "Financeiro",
        purpose: "Organiza valores do caso, pagamentos e leitura economica da jornada da paciente.",
        whenToUse: "Use quando houver necessidade de conferir recebimentos, cobrancas ou impacto financeiro do tratamento.",
        example: "Ao revisar um pacote, voce confere o que ja entrou e o que ainda depende de acerto.",
      },
      {
        id: "tab-assinaturas",
        title: "Assinaturas",
        purpose: "Armazena assinaturas vinculadas ao prontuario para formalizar aceite e documentacao.",
        whenToUse: "Use quando algum termo, consentimento ou documento precisar de confirmacao visual da paciente.",
        example: "Apos apresentar um termo de ciencia, a assinatura e registrada direto no prontuario.",
      },
      {
        id: "tab-homecare",
        title: "Homecare",
        purpose: "Registra recomendacao de kit, orientacoes de cuidado, forma de pagamento e data sugerida de retorno.",
        whenToUse: "Use no pos-atendimento para garantir continuidade do resultado fora da clinica.",
        example: "No fim da sessao, voce salva o kit indicado e define quando a paciente deve retornar.",
      },
      {
        id: "tab-galeria",
        title: "Galeria",
        purpose: "Guarda fotos de antes, depois e referencias para comparar visualmente a evolucao do caso.",
        whenToUse: "Use sempre que a imagem fizer parte da avaliacao, da comparacao ou da prova de resultado.",
        example: "Na revisao, voce coloca lado a lado as fotos do inicio e do pos-tratamento para mostrar avanco real.",
      },
      {
        id: "tab-etapas",
        title: "Etapas personalizadas",
        purpose: "Permitem adaptar a ordem e a presenca das etapas visiveis conforme o jeito de trabalhar da profissional ou da clinica.",
        whenToUse: "Use quando o fluxo padrao precisar ser reorganizado sem perder os modulos principais.",
        example: "Uma profissional prefere abrir Agenda antes da Ficha. Ela ajusta a ordem das etapas no proprio cabecalho do prontuario.",
      },
    ],
  },
] as const;

export const HELP_GUIDE_SCENARIOS: readonly HelpGuideScenario[] = [
  {
    id: "cenario-primeiro-atendimento",
    title: "Primeira avaliacao",
    summary: "Fluxo recomendado quando a paciente esta entrando na clinica e ainda nao existe historico solido dentro do sistema.",
    steps: [
      "Cadastre a paciente pela home usando 'Novo paciente'.",
      "Abra o prontuario e revise o Perfil para garantir contato e origem corretos.",
      "Ative ou acompanhe a pre-consulta em Links, se esse passo fizer parte do processo da clinica.",
      "Preencha a Ficha e depois registre a leitura tecnica em Saude.",
      "Defina o plano em Procedimentos e, se necessario, ja deixe um retorno em Agenda.",
    ],
  },
  {
    id: "cenario-retorno",
    title: "Retorno ou sessao de continuidade",
    summary: "Fluxo indicado quando a paciente ja tem historico e o foco e executar, medir resposta e manter a agenda organizada.",
    steps: [
      "Encontre a paciente pela busca ou filtro de jornada na home.",
      "Revise Evolucao e Galeria para entender o estado atual antes de executar a nova sessao.",
      "Registre a sessao em Procedimentos com os detalhes tecnicos relevantes.",
      "Se houver novo encontro, salve ou confirme o horario em Agenda e envie ao Google Calendar.",
      "Atualize Homecare caso o cuidado domiciliar ou a data de retorno tenham mudado.",
    ],
  },
  {
    id: "cenario-pos-venda",
    title: "Pos-venda e acompanhamento remoto",
    summary: "Fluxo pensado para sustentar resultado, orientar a paciente e manter o caso ativo entre uma visita e outra.",
    steps: [
      "Use Homecare para registrar o kit recomendado, as orientacoes e a forma de pagamento.",
      "Mantenha Links atualizados para facilitar acesso da paciente ao portal ou materiais necessarios.",
      "Consulte a Galeria e a Evolucao em retornos para comparar adesao e resposta ao plano.",
      "Acompanhe pela home quem esta sem retorno ou aguardando resposta para agir de forma proativa.",
    ],
  },
] as const;
