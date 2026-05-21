/**
 * Ficha de anamnese capilar alinhada ao ebook
 * "Ficha de Anamnese e Avaliação Clínica do Cabelo e Couro Cabeludo".
 * Todos os campos são opcionais para permitir preenchimento progressivo.
 */

export type FichaAnamneseDadosPessoais = {
  nome?: string;
  sexo?: string;
  dataNascimento?: string;
  endereco?: string;
  cidade?: string;
  profissao?: string;
  email?: string;
  celular?: string;
  filhos?: string;
};

export type FichaAnamneseQuedaAcentuada = {
  ausente?: boolean;
  presente?: boolean;
  localizada?: boolean;
  difusa?: boolean;
  haQuantoTempo?: string;
  periodosCessouVoltou?: string;
  fiosSendoSubstituidos?: string;
  eventoMarcante?: string;
  perdaVolumeIntensidade?: string;
  perdaPelosCorpo?: string;
};

export type FichaAnamneseAfinamentoHaste = {
  ausente?: boolean;
  presente?: boolean;
  haQuantoTempo?: string;
  casosCalvicieFamiliaParentesco?: string;
};

export type FichaAnamneseInflamacao = {
  ausente?: boolean;
  presente?: boolean;
  intensidade?: string;
  coceiraCouroCabeludo?: string;
  dorCouroCabeludoFrequencia?: string;
  descamacaoCaspa?: string;
  dermatiteSeborreica?: string;
};

export type FichaAnamneseDadosClinicos = {
  quedaAcentuada?: FichaAnamneseQuedaAcentuada;
  afinamentoHaste?: FichaAnamneseAfinamentoHaste;
  inflamacao?: FichaAnamneseInflamacao;
};

export type FichaAnamneseTratamentosAnteriores = {
  diagnosticoMedicoPrevio?: string;
  tratamentosEMedicamentosPrevios?: string;
  indicacaoProfissionalEResultados?: string;
};

export type FichaAnamneseHistoricoSaudeGeral = {
  problemaSaudeAtual?: string;
  doencaCronica?: string;
  hipertensao?: string;
  diabetes?: string;
  arritmia?: string;
  doencaAutoimune?: string;
  problemaRenalHepaticoGastrintestinal?: string;
  problemaNeurologico?: string;
  problemaCirculacaoTromboseEmbolia?: string;
  desregulacaoHormonal?: string;
  anticoncepcional?: string;
  medicamentoContinuo?: string;
  tratamentoMedicamentosoUltimoAno?: string;
  medicamentoAtualDiferente?: string;
  alergia?: string;
  historicoCirurgias?: string;
  gestante?: string;
  lactante?: string;
  menopausa?: string;
  menstruacao?: string;
  sindromeOvarioPolicistico?: string;
  peso?: string;
  examesLaboratoriais?: string;
};

export type FichaAnamneseHabitos = {
  frequenciaLavagem?: string;
  usoSecadorChapinha?: string;
  alisamentoQualTipoFrequencia?: string;
  produtosNoCabelo?: string;
  penteadosComTracao?: string;
  dorDecorrenteDaTracao?: string;
  implanteOuTransplanteCapilar?: string;
  fumante?: string;
  bebidaAlcoolica?: string;
  exercicioFisico?: string;
  alimentacao?: string;
  coposDeAguaPorDia?: string;
  horasDeSono?: string;
  pessoaEstressada?: string;
  pessoaAnsiosa?: string;
};

export type FichaAnamneseHistoricoFamiliar = {
  casosCalvicieFamilia?: string;
  alopeciaAreataOuAutoimunesFamilia?: string;
  doencasCongenitasDaHaste?: string;
};

export type FichaAnamneseExameFisico = {
  pullTest?: string;
  cardTest?: string;
  tugTest?: string;
  washTest?: string;
};

export type FichaAnamneseTricoscopia = {
  ostiosFoliculares?: {
    preto?: boolean;
    branco?: boolean;
    amarelo?: boolean;
    vermelho?: boolean;
    cinzaAzulado?: boolean;
  };
  epidermePeriInterfolicular?: {
    normal?: boolean;
    descamacaoAusente?: boolean;
    descamacaoLocalizada?: boolean;
    descamacaoDifusa?: boolean;
    descamacaoPerifolicular?: boolean;
    corCastanha?: boolean;
    corRosa?: boolean;
    corVermelha?: boolean;
    corBranca?: boolean;
    corAmarela?: boolean;
    corAzulViolaceo?: boolean;
  };
  alopeciaCaracteristica?: {
    aag?: boolean;
    aaSubtipo?: boolean;
    aaSubtipoDescricao?: string;
    etAgudo?: boolean;
    etCronico?: boolean;
    tricotilomania?: boolean;
    alopeciaCicatricial?: boolean;
    inconclusivo?: boolean;
  };
  observacoes?: string;
};

export type FichaAnamneseClassificacaoAag = {
  norwoodHamilton?: "" | "I" | "II" | "III" | "Vertex" | "IV" | "V" | "VI" | "VII";
  ludwig?: "" | "I" | "II" | "III";
  savin?: "" | "I-1" | "I-2" | "I-3" | "I-4" | "II-1" | "II-2" | "III" | "Advanced" | "Frontal";
};

export type FichaAnamneseAssinatura = {
  assinaturaBD?: string;
  dataAssinatura?: string;
};

/** Raiz JSON persistida em `ficha_anamnese_capilar.dados`. */
export type FichaAnamneseCapilarDados = {
  dadosPessoais?: FichaAnamneseDadosPessoais;
  queixaPrincipal?: string;
  dadosClinicos?: FichaAnamneseDadosClinicos;
  tratamentosAnteriores?: FichaAnamneseTratamentosAnteriores;
  historicoSaudeGeral?: FichaAnamneseHistoricoSaudeGeral;
  habitos?: FichaAnamneseHabitos;
  historicoFamiliar?: FichaAnamneseHistoricoFamiliar;
  exameFisico?: FichaAnamneseExameFisico;
  tricoscopia?: FichaAnamneseTricoscopia;
  classificacaoAag?: FichaAnamneseClassificacaoAag;
  diagnosticoClinico?: string;
  condutaPrescrita?: string;
  assinatura?: FichaAnamneseAssinatura;
};
