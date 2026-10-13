import { CONFIG } from "./config.js";

/**
 * @typedef {Object} IdentidadeEleitor
 * @property {string} enderecoPublico
 * @property {string} chavePrivada
 * @property {string} hashIdentidade
 * @property {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Wallet} carteira
 */

/**
 * Valida o identificador informado pelo eleitor.
 * @param {string} identificador
 * @returns {string}
 */
export function validarIdentificador(identificador) {
  if (typeof identificador !== "string") {
    throw new Error("Identificador inválido.");
  }
  const valor = identificador.trim();
  if (valor.length < 3) {
    throw new Error("Informe um identificador com pelo menos 3 caracteres.");
  }
  return valor;
}

/**
 * Obtém a carteira persistida ou cria uma nova no navegador.
 * @param {typeof import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm")} ethers
 * @returns {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Wallet}
 */
export function obterOuCriarCarteira(ethers) {
  let chavePrivada = localStorage.getItem(CONFIG.STORAGE_CHAVE_PRIVADA);
  if (!chavePrivada) {
    const novaCarteira = ethers.Wallet.createRandom();
    chavePrivada = novaCarteira.privateKey;
    localStorage.setItem(CONFIG.STORAGE_CHAVE_PRIVADA, chavePrivada);
  }
  return new ethers.Wallet(chavePrivada);
}

/**
 * Apaga a chave privada do navegador (não altera o estado on-chain).
 * @returns {void}
 */
export function limparCarteiraLocal() {
  localStorage.removeItem(CONFIG.STORAGE_CHAVE_PRIVADA);
}

/**
 * Monta a identidade criptográfica do eleitor (carteira + nullifier hash).
 * O identificador nunca sai do navegador — apenas o hash vai on-chain.
 * @param {typeof import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm")} ethers
 * @param {string} identificadorBruto
 * @returns {IdentidadeEleitor}
 */
export function montarIdentidade(ethers, identificadorBruto) {
  const identificador = validarIdentificador(identificadorBruto);
  const carteira = obterOuCriarCarteira(ethers);
  const hashIdentidade = ethers.id(identificador + CONFIG.SALT_IDENTIDADE);

  return {
    enderecoPublico: carteira.address,
    chavePrivada: carteira.privateKey,
    hashIdentidade,
    carteira,
  };
}

/**
 * Assina o hash de habilitação no formato esperado pelo contrato.
 * @param {typeof import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm")} ethers
 * @param {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Wallet} carteira
 * @param {string} hashIdentidade
 * @returns {Promise<string>}
 */
export async function assinarHabilitacao(ethers, carteira, hashIdentidade) {
  const mensagem = ethers.solidityPackedKeccak256(
    ["string", "address", "bytes32"],
    ["urna-habilitar:", carteira.address, hashIdentidade]
  );
  return carteira.signMessage(ethers.getBytes(mensagem));
}

/**
 * Assina o hash de voto no formato esperado pelo contrato.
 * @param {typeof import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm")} ethers
 * @param {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Wallet} carteira
 * @param {number} candidato
 * @param {string} uf
 * @returns {Promise<string>}
 */
export async function assinarVoto(ethers, carteira, candidato, uf) {
  const mensagem = ethers.solidityPackedKeccak256(
    ["string", "address", "uint8", "string"],
    ["urna-votar:", carteira.address, candidato, uf]
  );
  return carteira.signMessage(ethers.getBytes(mensagem));
}
