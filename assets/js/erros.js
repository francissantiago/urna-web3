/**
 * Extrai e traduz erros do contrato/Relayer para mensagens curtas.
 * Evita despejar hex e JSON do ethers na interface.
 * @param {unknown} bruto
 * @returns {string}
 */
export function resumirErroOnChain(bruto) {
  const texto = extrairTexto(bruto);
  if (!texto) {
    return "Falha na comunicação com a blockchain.";
  }

  const conhecido = mapearMensagemConhecida(texto);
  if (conhecido) {
    return conhecido;
  }

  const reasonAspas = texto.match(/reason="([^"]+)"/i);
  if (reasonAspas?.[1]) {
    return mapearMensagemConhecida(reasonAspas[1]) || reasonAspas[1];
  }

  const reverted = texto.match(/execution reverted:\s*"([^"]+)"/i);
  if (reverted?.[1]) {
    return mapearMensagemConhecida(reverted[1]) || reverted[1];
  }

  const shortRevert = texto.match(/reverted with reason string '([^']+)'/i);
  if (shortRevert?.[1]) {
    return mapearMensagemConhecida(shortRevert[1]) || shortRevert[1];
  }

  if (texto.length > 160) {
    return "A transação foi recusada pelo contrato. Confira se o identificador ou a carteira já foram usados.";
  }
  return texto;
}

/**
 * @param {unknown} bruto
 * @returns {string}
 */
function extrairTexto(bruto) {
  if (typeof bruto === "string") {
    return bruto;
  }
  if (bruto instanceof Error) {
    return bruto.message;
  }
  if (bruto && typeof bruto === "object") {
    const obj = /** @type {{ reason?: string, shortMessage?: string, message?: string }} */ (
      bruto
    );
    return obj.reason || obj.shortMessage || obj.message || "";
  }
  return "";
}

/**
 * @param {string} mensagem
 * @returns {string | null}
 */
function mapearMensagemConhecida(mensagem) {
  const mapa = [
    [
      "Individuo ja recebeu um token de voto",
      "Este identificador já recebeu um token de voto. Use outro identificador ou continue com a carteira já habilitada.",
    ],
    [
      "Este endereco ja foi registrado",
      "Esta carteira já foi habilitada. Você já pode votar (ou já votou).",
    ],
    [
      "Sem token de voto disponivel",
      "Sem token de voto disponível. Habilite-se primeiro ou você já votou.",
    ],
    ["Opcao de candidato invalida", "Opção de candidato inválida."],
    ["Informe a sigla da UF com 2 letras", "Informe a sigla da UF com 2 letras."],
    ["UF invalida", "UF inválida."],
    ["Assinatura invalida", "Assinatura inválida. Tente habilitar/votar novamente."],
    ["Eleitor invalido", "Endereço do eleitor inválido."],
  ];

  for (const [trecho, amigavel] of mapa) {
    if (mensagem.includes(trecho)) {
      return amigavel;
    }
  }
  return null;
}
