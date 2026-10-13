import { CONFIG } from "./config.js";
import { resumirErroOnChain } from "./erros.js";

/**
 * Envia um pedido assinado ao Relayer (Cloudflare Worker).
 * @param {"habilitar" | "votar"} acao
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{txHash: string}>}
 */
export async function enviarAoRelayer(acao, payload) {
  if (acao !== "habilitar" && acao !== "votar") {
    throw new Error("Ação do Relayer inválida.");
  }
  if (!CONFIG.RELAYER_URL) {
    throw new Error("RELAYER_URL não configurada em assets/js/config.js.");
  }

  const resposta = await fetch(CONFIG.RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao, ...payload }),
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const detalhe = corpo.erro || corpo.error || resposta.statusText;
    throw new Error(resumirErroOnChain(detalhe));
  }
  if (!corpo.txHash || typeof corpo.txHash !== "string") {
    throw new Error("Relayer não retornou o hash da transação.");
  }
  return { txHash: corpo.txHash };
}
