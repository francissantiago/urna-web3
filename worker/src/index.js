import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getBytes,
  solidityPackedKeccak256,
  verifyMessage,
} from "ethers";

const ABI_ESCRITA = [
  "function habilitarEleitor(address eleitor, bytes32 hashIdentidadeUnica, bytes assinatura)",
  "function votar(address eleitor, uint8 candidato, string uf, bytes assinatura)",
];

const UFS_VALIDAS = new Set([
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

/**
 * Cloudflare Worker que patrocina o gas apenas para habilitarEleitor e votar.
 * @param {Request} request
 * @param {{ RELAYER_PRIVATE_KEY: string, RPC_URL: string, CONTRACT_ADDRESS: string }} env
 * @returns {Promise<Response>}
 */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return responderCors(new Response(null, { status: 204 }));
    }

    if (request.method !== "POST") {
      return jsonErro("Use POST com JSON { acao, ... }.", 405);
    }

    try {
      validarAmbiente(env);
      const corpo = await request.json();
      const acao = corpo?.acao;

      if (acao === "habilitar") {
        const resultado = await processarHabilitacao(env, corpo);
        return responderCors(Response.json(resultado));
      }
      if (acao === "votar") {
        const resultado = await processarVoto(env, corpo);
        return responderCors(Response.json(resultado));
      }

      return jsonErro("Ação inválida. Use 'habilitar' ou 'votar'.", 400);
    } catch (erro) {
      return jsonErro(resumirErroRelayer(erro), 400);
    }
  },
};

/**
 * @param {{ RELAYER_PRIVATE_KEY: string, RPC_URL: string, CONTRACT_ADDRESS: string }} env
 * @param {Record<string, unknown>} corpo
 */
async function processarHabilitacao(env, corpo) {
  const eleitor = exigirEndereco(corpo.eleitor, "eleitor");
  const hashIdentidade = exigirBytes32(corpo.hashIdentidade, "hashIdentidade");
  const assinatura = exigirAssinatura(corpo.assinatura);

  const mensagem = solidityPackedKeccak256(
    ["string", "address", "bytes32"],
    ["urna-habilitar:", eleitor, hashIdentidade]
  );
  await garantirAssinante(eleitor, mensagem, assinatura);

  const contrato = criarContratoEscrita(env);
  const tx = await contrato.habilitarEleitor(eleitor, hashIdentidade, assinatura);
  const recibo = await tx.wait();
  return { txHash: recibo.hash || tx.hash };
}

/**
 * @param {{ RELAYER_PRIVATE_KEY: string, RPC_URL: string, CONTRACT_ADDRESS: string }} env
 * @param {Record<string, unknown>} corpo
 */
async function processarVoto(env, corpo) {
  const eleitor = exigirEndereco(corpo.eleitor, "eleitor");
  const candidato = Number(corpo.candidato);
  const uf = exigirUf(corpo.uf);
  const assinatura = exigirAssinatura(corpo.assinatura);

  if (!Number.isInteger(candidato) || ![0, 13, 22].includes(candidato)) {
    throw new Error("Candidato inválido. Use 13, 22 ou 0 (branco/nulo).");
  }

  const mensagem = solidityPackedKeccak256(
    ["string", "address", "uint8", "string"],
    ["urna-votar:", eleitor, candidato, uf]
  );
  await garantirAssinante(eleitor, mensagem, assinatura);

  const contrato = criarContratoEscrita(env);
  const tx = await contrato.votar(eleitor, candidato, uf, assinatura);
  const recibo = await tx.wait();
  return { txHash: recibo.hash || tx.hash };
}

/**
 * @param {{ RELAYER_PRIVATE_KEY: string, RPC_URL: string, CONTRACT_ADDRESS: string }} env
 */
function criarContratoEscrita(env) {
  const provedor = new JsonRpcProvider(env.RPC_URL);
  const carteira = new Wallet(env.RELAYER_PRIVATE_KEY, provedor);
  return new Contract(env.CONTRACT_ADDRESS, ABI_ESCRITA, carteira);
}

/**
 * @param {string} eleitor
 * @param {string} hashMensagem
 * @param {string} assinatura
 */
async function garantirAssinante(eleitor, hashMensagem, assinatura) {
  const recuperado = verifyMessage(getBytes(hashMensagem), assinatura);
  if (recuperado.toLowerCase() !== eleitor.toLowerCase()) {
    throw new Error("Assinatura não corresponde ao eleitor declarado.");
  }
}

/**
 * @param {{ RELAYER_PRIVATE_KEY?: string, RPC_URL?: string, CONTRACT_ADDRESS?: string }} env
 */
function validarAmbiente(env) {
  if (!env.RELAYER_PRIVATE_KEY) {
    throw new Error("RELAYER_PRIVATE_KEY não configurada.");
  }
  if (!env.RPC_URL) {
    throw new Error("RPC_URL não configurada.");
  }
  if (!env.CONTRACT_ADDRESS || env.CONTRACT_ADDRESS.endsWith("0000")) {
    throw new Error("CONTRACT_ADDRESS não configurado.");
  }
}

/**
 * @param {unknown} valor
 * @param {string} nome
 * @returns {string}
 */
function exigirEndereco(valor, nome) {
  if (typeof valor !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(valor)) {
    throw new Error(`Campo ${nome} deve ser um endereço Ethereum.`);
  }
  return valor;
}

/**
 * @param {unknown} valor
 * @param {string} nome
 * @returns {string}
 */
function exigirBytes32(valor, nome) {
  if (typeof valor !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(valor)) {
    throw new Error(`Campo ${nome} deve ser bytes32 (0x + 64 hex).`);
  }
  return valor;
}

/**
 * @param {unknown} valor
 * @returns {string}
 */
function exigirAssinatura(valor) {
  if (typeof valor !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(valor)) {
    throw new Error("Assinatura inválida.");
  }
  return valor;
}

/**
 * @param {unknown} valor
 * @returns {string}
 */
function exigirUf(valor) {
  if (typeof valor !== "string") {
    throw new Error("UF inválida.");
  }
  const uf = valor.trim().toUpperCase();
  if (!UFS_VALIDAS.has(uf)) {
    throw new Error("UF inválida.");
  }
  return uf;
}

/**
 * Reduz dumps do ethers a uma frase curta para o front-end.
 * @param {unknown} erro
 * @returns {string}
 */
function resumirErroRelayer(erro) {
  if (!(erro instanceof Error) && typeof erro !== "object") {
    return "Erro interno no Relayer.";
  }

  const obj = /** @type {{ reason?: string, shortMessage?: string, message?: string }} */ (
    erro instanceof Error ? erro : erro
  );
  const texto = obj.reason || obj.shortMessage || obj.message || String(erro);

  const conhecidos = [
    "Individuo ja recebeu um token de voto.",
    "Este endereco ja foi registrado.",
    "Sem token de voto disponivel (ja votou ou nao habilitado).",
    "Opcao de candidato invalida.",
    "Informe a sigla da UF com 2 letras.",
    "UF invalida.",
    "Assinatura invalida.",
    "Eleitor invalido.",
  ];
  for (const msg of conhecidos) {
    if (texto.includes(msg.replace(/\.$/, ""))) {
      return msg;
    }
  }

  const reasonAspas = texto.match(/reason="([^"]+)"/i);
  if (reasonAspas?.[1]) {
    return reasonAspas[1];
  }
  const reverted = texto.match(/execution reverted:\s*"([^"]+)"/i);
  if (reverted?.[1]) {
    return reverted[1];
  }
  if (texto.length > 180) {
    return "A transação foi recusada pelo contrato.";
  }
  return texto || "Erro interno no Relayer.";
}

/**
 * @param {string} mensagem
 * @param {number} status
 */
function jsonErro(mensagem, status) {
  return responderCors(Response.json({ erro: mensagem }, { status }));
}

/**
 * @param {Response} resposta
 */
function responderCors(resposta) {
  const headers = new Headers(resposta.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(resposta.body, {
    status: resposta.status,
    statusText: resposta.statusText,
    headers,
  });
}
