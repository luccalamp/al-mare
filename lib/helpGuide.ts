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
    description: "A tela inicial serve para localizar pacientes, filtrar a jornada e abrir os atalhos principais da clínica.",
  },
  {
    title: "Atenda por etapas",
    description: "Cada prontuário foi dividido em blocos para evitar retrabalho: dados, avaliação, agenda, evolução e pós-venda.",
  },
  {
    title: "Feche o ciclo",
    description: "Depois do atendimento, registre orientações, retorno, homecare e materiais do portal para manter o acompanhamento vivo.",
  },
] as const;

export const HELP_GUIDE_SECTIONS: readonly HelpGuideSection[] = [
  {
    id: "workspace",
    kicker: "Visão geral",
    title: "Home da clínica",
    description: "Essa é a mesa de trabalho principal. Tudo começa aqui: localizar pacientes, abrir módulos centrais e acompanhar o ritmo da operação.",
    items: [
      {
        id: "workspace-home",
        title: "Workspace clínico",
        purpose: "Mostra o panorama da operação e reúne os atalhos para prontuários, arquivos e indicadores.",
        whenToUse: "Use ao iniciar o expediente ou quando precisar decidir rapidamente para onde ir dentro do sistema.",
        example: "Você abre a home para ver quantas pacientes estão no recorte atual e escolher quem será atendida em seguida.",
      },
      {
        id: "workspace-search",
        title: "Busca principal",
        purpose: "Encontra paciente, protocolo ou prontuário sem precisar navegar manualmente pela grade.",
        whenToUse: "Use quando já souber parte do nome, do protocolo ou quiser chegar direto em um caso específico.",
        example: "Digite o nome da paciente para abrir o prontuário sem passar por todas as pastas na tela.",
      },
      {
        id: "workspace-filters",
        title: "Filtros de jornada",
        purpose: "Separam as pacientes por estágio do fluxo: triagem, aguardando resposta, avaliação, retorno ou acompanhamento.",
        whenToUse: "Use quando quiser organizar o dia por prioridade operacional e não só por ordem alfabética.",
        example: "Antes de enviar follow-up, filtre por 'Sem retorno' para achar quem precisa de contato.",
      },
      {
        id: "workspace-new-client",
        title: "Novo paciente",
        purpose: "Cria um prontuário completo para iniciar o atendimento sem depender de anotações soltas.",
        whenToUse: "Use sempre que entrar uma nova paciente na clínica ou quando um cadastro precisar nascer do zero.",
        example: "Uma nova avaliação foi fechada por WhatsApp. Você cadastra a paciente e já abre o prontuário para preparar a consulta.",
      },
      {
        id: "workspace-dashboard",
        title: "Dashboard financeiro",
        purpose: "Concentra visão operacional, receita, comportamento da base e áreas de controle da clínica.",
        whenToUse: "Use para leitura de resultado, checagem de performance ou conferência de movimentação por período.",
        example: "No fechamento da semana, você abre o dashboard para comparar receita e recorrência de atendimentos.",
      },
      {
        id: "workspace-documents",
        title: "Central de arquivos",
        purpose: "Guarda documentos, materiais e pastas internas em um ponto único da clínica.",
        whenToUse: "Use quando precisar consultar PDFs, subir materiais, organizar documentos por pasta ou recuperar um arquivo rápido.",
        example: "Você precisa reenviar um termo ou um material interno e abre Arquivos em vez de procurar fora do sistema.",
      },
      {
        id: "workspace-branding",
        title: "Personalizar marca e textos",
        purpose: "Ajusta nome da clínica, textos principais e elementos visuais usados nas telas e documentos.",
        whenToUse: "Use quando a clínica mudar assinatura, comunicação, rótulos ou identidade apresentada para paciente e equipe.",
        example: "A profissional quer trocar o texto da pré-consulta e revisar o nome mostrado nas telas. Essa configuração fica aqui.",
      },
    ],
  },
  {
    id: "prontuario",
    kicker: "Fluxo do atendimento",
    title: "Prontuário da paciente",
    description: "O prontuário é o centro clínico do sistema. Cada aba representa uma etapa do atendimento para registrar o caso e acompanhar a evolução sem perder contexto.",
    items: [
      {
        id: "tab-perfil",
        title: "Perfil",
        purpose: "Concentra dados cadastrais, contatos, origem da paciente e informações-base do relacionamento.",
        whenToUse: "Use para revisar ou atualizar os dados principais antes do atendimento e antes de qualquer comunicação.",
        example: "Antes de enviar um retorno, você confere WhatsApp, cidade, observações internas e origem da paciente.",
      },
      {
        id: "tab-agenda",
        title: "Agenda",
        purpose: "Registra horários da paciente, histórico de agendamentos e integração com o Google Calendar.",
        whenToUse: "Use para criar, confirmar e revisar sessões futuras ou passadas ligadas ao tratamento.",
        example: "Ao fechar um retorno de terapia, você agenda a sessão e envia o evento para o Google Calendar.",
      },
      {
        id: "tab-links",
        title: "Links",
        purpose: "Controla pré-consulta e acessos compartilháveis, como portal e materiais que a paciente pode abrir fora da clínica.",
        whenToUse: "Use quando precisar enviar um link ativo, reabrir acesso ou conferir se a paciente já respondeu uma etapa remota.",
        example: "Antes da consulta, você ativa a pré-consulta para que a paciente envie informações antes de chegar.",
      },
      {
        id: "tab-anamnese",
        title: "Ficha",
        purpose: "Guarda a anamnese capilar estruturada, com histórico clínico e respostas essenciais do caso.",
        whenToUse: "Use na primeira avaliação ou quando um quadro clínico exigir atualização formal das respostas.",
        example: "Na consulta inicial, a profissional registra hábitos, histórico e sinais clínicos em vez de deixar isso disperso em notas.",
      },
      {
        id: "tab-diagnostico",
        title: "Saúde",
        purpose: "Registra diagnóstico capilar, resultados de testes e leitura técnica do estado atual do fio e couro cabeludo.",
        whenToUse: "Use quando a profissional precisar sustentar a conduta com avaliação técnica e comparar evolução depois.",
        example: "Após o teste de mecha, você registra porosidade, elasticidade e observações para orientar o tratamento.",
      },
      {
        id: "tab-procedimentos",
        title: "Procedimentos",
        purpose: "Documenta sessões, protocolos executados, fórmulas, orçamento e decisões técnicas do atendimento.",
        whenToUse: "Use durante ou logo após o procedimento para manter o histórico fiel ao que foi realizado.",
        example: "Depois da sessão, você salva técnica usada, etapas da terapia e valores combinados.",
      },
      {
        id: "tab-evolucao",
        title: "Evolução",
        purpose: "Acompanha plano terapêutico e resposta da paciente ao longo das semanas.",
        whenToUse: "Use em retornos, reavaliações e momentos em que for preciso comparar progresso e aderência.",
        example: "Na quarta semana, você revisa a evolução para decidir se mantém a mesma linha de conduta.",
      },
      {
        id: "tab-financeiro",
        title: "Financeiro",
        purpose: "Organiza valores do caso, pagamentos e leitura econômica da jornada da paciente.",
        whenToUse: "Use quando houver necessidade de conferir recebimentos, cobranças ou impacto financeiro do tratamento.",
        example: "Ao revisar um pacote, você confere o que já entrou e o que ainda depende de acerto.",
      },
      {
        id: "tab-assinaturas",
        title: "Assinaturas",
        purpose: "Armazena assinaturas vinculadas ao prontuário para formalizar aceite e documentação.",
        whenToUse: "Use quando algum termo, consentimento ou documento precisar de confirmação visual da paciente.",
        example: "Após apresentar um termo de ciência, a assinatura é registrada direto no prontuário.",
      },
      {
        id: "tab-homecare",
        title: "Homecare",
        purpose: "Registra recomendação de kit, orientações de cuidado, forma de pagamento e data sugerida de retorno.",
        whenToUse: "Use no pós-atendimento para garantir continuidade do resultado fora da clínica.",
        example: "No fim da sessão, você salva o kit indicado e define quando a paciente deve retornar.",
      },
      {
        id: "tab-galeria",
        title: "Galeria",
        purpose: "Guarda fotos de antes, depois e referências para comparar visualmente a evolução do caso.",
        whenToUse: "Use sempre que a imagem fizer parte da avaliação, da comparação ou da prova de resultado.",
        example: "Na revisão, você coloca lado a lado as fotos do início e do pós-tratamento para mostrar avanço real.",
      },
      {
        id: "tab-etapas",
        title: "Etapas personalizadas",
        purpose: "Permitem adaptar a ordem e a presença das etapas visíveis conforme o jeito de trabalhar da profissional ou da clínica.",
        whenToUse: "Use quando o fluxo padrão precisar ser reorganizado sem perder os módulos principais.",
        example: "Uma profissional prefere abrir Agenda antes da Ficha. Ela ajusta a ordem das etapas no próprio cabeçalho do prontuário.",
      },
    ],
  },
] as const;

export const HELP_GUIDE_SCENARIOS: readonly HelpGuideScenario[] = [
  {
    id: "cenario-primeiro-atendimento",
    title: "Primeira avaliação",
    summary: "Fluxo recomendado quando a paciente está entrando na clínica e ainda não existe histórico sólido dentro do sistema.",
    steps: [
      "Cadastre a paciente pela home usando 'Novo paciente'.",
      "Abra o prontuário e revise o Perfil para garantir contato e origem corretos.",
      "Ative ou acompanhe a pré-consulta em Links, se esse passo fizer parte do processo da clínica.",
      "Preencha a Ficha e depois registre a leitura técnica em Saúde.",
      "Defina o plano em Procedimentos e, se necessário, já deixe um retorno em Agenda.",
    ],
  },
  {
    id: "cenario-retorno",
    title: "Retorno ou sessão de continuidade",
    summary: "Fluxo indicado quando a paciente já tem histórico e o foco é executar, medir resposta e manter a agenda organizada.",
    steps: [
      "Encontre a paciente pela busca ou filtro de jornada na home.",
      "Revise Evolução e Galeria para entender o estado atual antes de executar a nova sessão.",
      "Registre a sessão em Procedimentos com os detalhes técnicos relevantes.",
      "Se houver novo encontro, salve ou confirme o horário em Agenda e envie ao Google Calendar.",
      "Atualize Homecare caso o cuidado domiciliar ou a data de retorno tenham mudado.",
    ],
  },
  {
    id: "cenario-pos-venda",
    title: "Pós-venda e acompanhamento remoto",
    summary: "Fluxo pensado para sustentar resultado, orientar a paciente e manter o caso ativo entre uma visita e outra.",
    steps: [
      "Use Homecare para registrar o kit recomendado, as orientações e a forma de pagamento.",
      "Mantenha Links atualizados para facilitar acesso da paciente ao portal ou materiais necessários.",
      "Consulte a Galeria e a Evolução em retornos para comparar adesão e resposta ao plano.",
      "Acompanhe pelo filtro de jornada quem está sem retorno ou aguardando resposta para agir proativamente.",
    ],
  },
] as const;