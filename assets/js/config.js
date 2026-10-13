/**
 * Configuração pública do front-end.
 * Após o deploy, atualize CONTRACT_ADDRESS e RELAYER_URL.
 */
export const CONFIG = {
  CHAIN_ID: 11155111,
  NETWORK_NAME: "Sepolia",
  RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
  CONTRACT_ADDRESS: "0xd082e90BB285Dd0B1dcf371eAd84518415aD0942",
  RELAYER_URL: "https://urna-web3-relayer.urnaweb3.workers.dev",
  ETHERSCAN_TX_BASE: "https://sepolia.etherscan.io/tx/",
  SALT_IDENTIDADE: "_SALT_ELEICAO_2026",
  STORAGE_CHAVE_PRIVADA: "eleitor_pk",
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
