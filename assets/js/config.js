/**
 * Configuração pública do front-end.
 * Após o deploy, atualize CONTRACT_ADDRESS e RELAYER_URL.
 */
export const CONFIG = {
  CHAIN_ID: 11155111,
  NETWORK_NAME: "Sepolia",
  RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
  CONTRACT_ADDRESS: "0x8cc9f1Ede4368D39Cae377f8ac6E2daC36c5CE23",
  RELAYER_URL: "https://urna-web3-relayer.urnaweb3.workers.dev",
  ETHERSCAN_TX_BASE: "https://sepolia.etherscan.io/tx/",
  SALT_IDENTIDADE: "_SALT_ELEICAO_2026",
  STORAGE_CHAVE_PRIVADA: "eleitor_pk",
  /** Fallback do contador: 25/10/2026 17:00 horário de Brasília (UTC-3). */
  FIM_VOTACAO_UNIX: 1792958400,
  FIM_VOTACAO_ROTULO: "25/10/2026 às 17:00 (horário de Brasília)",
};

/** Códigos de legenda (urna brasileira) → nome de urna. */
export const NOMES_CANDIDATOS = {
  0: "Branco / Nulo",
  13: 'Luiz Inácio "Lula" da Silva',
  22: "Flávio Bolsonaro",
};

/** Códigos válidos para voto nominal (além do 0 = branco/nulo). */
export const CODIGOS_CANDIDATOS = Object.freeze([13, 22]);

export const UFS_VALIDAS = Object.freeze([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);
