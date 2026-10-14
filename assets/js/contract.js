import { CONFIG } from "./config.js";

/** ABI mínima das funções e eventos usados pelo front-end. */
export const ABI_ELEICAO = [
  "function saldoTokenVoto(address) view returns (uint256)",
  "function totalVotos(uint8) view returns (uint256)",
  "function votosPorUF(string,uint8) view returns (uint256)",
  "function carteiraJaHabilitada(address) view returns (bool)",
  "function identidadeJaRegistrada(bytes32) view returns (bool)",
  "function fimVotacao() view returns (uint256)",
  "function votacaoAberta() view returns (bool)",
  "event EleitorHabilitado(address indexed eleitor, uint256 tokensRecebidos)",
  "event VotoComputado(address indexed eleitor, uint8 indexed candidato, string uf, uint256 timestamp)",
];

/**
 * @param {typeof import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm")} ethers
 * @returns {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Contract}
 */
export function criarContratoLeitura(ethers) {
  if (!CONFIG.CONTRACT_ADDRESS || CONFIG.CONTRACT_ADDRESS.endsWith("0000")) {
    throw new Error(
      "CONTRACT_ADDRESS ainda não foi configurado. Faça o deploy e atualize assets/js/config.js."
    );
  }
  const provedor = new ethers.JsonRpcProvider(CONFIG.RPC_URL, CONFIG.CHAIN_ID);
  return new ethers.Contract(CONFIG.CONTRACT_ADDRESS, ABI_ELEICAO, provedor);
}

/**
 * Lê o saldo de token de voto do eleitor.
 * @param {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Contract} contrato
 * @param {string} endereco
 * @returns {Promise<number>}
 */
export async function lerSaldoToken(contrato, endereco) {
  const saldo = await contrato.saldoTokenVoto(endereco);
  return Number(saldo);
}

/**
 * Lê o placar total (13, 22 e branco/nulo).
 * @param {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Contract} contrato
 * @returns {Promise<{branco: number, lula: number, bolsonaro: number}>}
 */
export async function lerTotais(contrato) {
  const [branco, lula, bolsonaro] = await Promise.all([
    contrato.totalVotos(0),
    contrato.totalVotos(13),
    contrato.totalVotos(22),
  ]);
  return {
    branco: Number(branco),
    lula: Number(lula),
    bolsonaro: Number(bolsonaro),
  };
}

/**
 * Lê o timestamp de encerramento on-chain.
 * @param {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Contract} contrato
 * @returns {Promise<number>}
 */
export async function lerFimVotacao(contrato) {
  const fim = await contrato.fimVotacao();
  return Number(fim);
}

/**
 * Escuta novos eventos VotoComputado e reprocessa o histórico recente.
 * @param {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Contract} contrato
 * @param {(voto: {eleitor: string, candidato: number, uf: string, timestamp: number, txHash: string}) => void} aoVoto
 * @returns {Promise<() => void>} Função para cancelar a escuta.
 */
export async function escutarVotos(contrato, aoVoto) {
  const filtro = contrato.filters.VotoComputado();
  const blocoAtual = await contrato.runner.provider.getBlockNumber();
  const blocoInicial = Math.max(0, blocoAtual - 5000);

  const historico = await contrato.queryFilter(filtro, blocoInicial, blocoAtual);
  for (const evento of historico) {
    aoVoto(mapearEventoVoto(evento));
  }

  const aoEvento = (...args) => {
    const evento = args[args.length - 1];
    aoVoto(mapearEventoVoto(evento));
  };
  contrato.on(filtro, aoEvento);

  return () => {
    contrato.off(filtro, aoEvento);
  };
}

/**
 * @param {{ args: { eleitor: string, candidato: bigint | number, uf: string, timestamp: bigint | number }, transactionHash?: string, log?: { transactionHash: string } }} evento
 */
function mapearEventoVoto(evento) {
  const txHash = evento.transactionHash || evento.log?.transactionHash || "";
  return {
    eleitor: evento.args.eleitor,
    candidato: Number(evento.args.candidato),
    uf: evento.args.uf,
    timestamp: Number(evento.args.timestamp),
    txHash,
  };
}
