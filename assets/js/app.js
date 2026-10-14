import { CODIGOS_CANDIDATOS, CONFIG, NOMES_CANDIDATOS } from "./config.js";
import {
  criarContratoLeitura,
  escutarVotos,
  lerFimVotacao,
  lerSaldoToken,
  lerTotais,
} from "./contract.js";
import { iniciarContador } from "./countdown.js";
import { resumirErroOnChain } from "./erros.js";
import { NOMES_UF, obterUfSelecionada } from "./geo.js";
import { enviarAoRelayer } from "./relayer.js";
import {
  assinarHabilitacao,
  assinarVoto,
  limparCarteiraLocal,
  montarIdentidade,
} from "./wallet.js";

/** @type {typeof import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm") | null} */
let ethers = null;

/** @type {ReturnType<typeof montarIdentidade> | null} */
let identidadeAtual = null;

/** @type {import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm").Contract | null} */
let contrato = null;

/** @type {number | null} */
let candidatoSelecionado = null;

/** @type {boolean} */
let isVotacaoEncerrada = false;

/** @type {boolean} */
let isAcaoEmAndamento = false;

const elementos = {
  identificador: document.getElementById("identificador"),
  btnHabilitar: document.getElementById("btn-habilitar"),
  enderecoPublico: document.getElementById("endereco-publico"),
  chavePrivada: document.getElementById("chave-privada"),
  btnRevelarChave: document.getElementById("btn-revelar-chave"),
  btnNovaIdentidade: document.getElementById("btn-nova-identidade"),
  saldoToken: document.getElementById("saldo-token"),
  statusIdentidade: document.getElementById("status-identidade"),
  selectUf: document.getElementById("select-uf"),
  btnConfirmarVoto: document.getElementById("btn-confirmar-voto"),
  statusUrna: document.getElementById("status-urna"),
  totalBranco: document.getElementById("total-branco"),
  total13: document.getElementById("total-13"),
  total22: document.getElementById("total-22"),
  tabelaVotos: document.getElementById("tabela-votos"),
  statusAuditoria: document.getElementById("status-auditoria"),
  contadorRestante: document.getElementById("contador-restante"),
  contadorRotulo: document.getElementById("contador-rotulo"),
  contadorFim: document.getElementById("contador-fim"),
  painelContador: document.getElementById("painel-contador"),
};

/**
 * Inicializa ethers, contrato (se configurado) e listeners da interface.
 * @returns {Promise<void>}
 */
async function iniciarAplicacao() {
  ethers = await import("https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm");
  preencherSeletorUf();
  ligarEventosUi();
  await iniciarContadorVotacao();

  try {
    contrato = criarContratoLeitura(ethers);
    await atualizarPlacar();
    await escutarVotos(contrato, adicionarVotoNaTabela);
    definirTexto(elementos.statusAuditoria, "Escutando eventos VotoComputado na Sepolia.");
  } catch (erro) {
    definirTexto(
      elementos.statusAuditoria,
      erro instanceof Error ? erro.message : "Contrato ainda não configurado."
    );
  }
}

/**
 * Lê o fim on-chain (ou usa o fallback do config) e liga o contador.
 * @returns {Promise<void>}
 */
async function iniciarContadorVotacao() {
  let fimUnix = CONFIG.FIM_VOTACAO_UNIX;
  try {
    if (!contrato) {
      contrato = criarContratoLeitura(ethers);
    }
    fimUnix = await lerFimVotacao(contrato);
  } catch {
    // Mantém fallback de config.js até o novo contrato com fimVotacao ser implantado.
  }

  if (elementos.contadorFim) {
    elementos.contadorFim.textContent = `Encerra em ${CONFIG.FIM_VOTACAO_ROTULO}`;
  }

  iniciarContador({
    fimUnix,
    elementoRestante: elementos.contadorRestante,
    elementoRotulo: elementos.contadorRotulo,
    aoMudarEstado: definirEstadoEncerramento,
  });
}

/**
 * @param {boolean} encerrada
 */
function definirEstadoEncerramento(encerrada) {
  isVotacaoEncerrada = encerrada;
  elementos.painelContador?.classList.toggle("is-encerrada", encerrada);
  atualizarControlesInterativos();

  if (encerrada) {
    definirTexto(
      elementos.statusUrna,
      "Votação encerrada. Habilitação e votos não são mais aceitos.",
      { isErro: true }
    );
  }
}

/**
 * Desabilita controles de voto/habilitação durante ações ou após o encerramento.
 */
function atualizarControlesInterativos() {
  const bloquear = isVotacaoEncerrada || isAcaoEmAndamento;

  if (elementos.btnHabilitar instanceof HTMLButtonElement) {
    elementos.btnHabilitar.disabled = bloquear;
  }
  if (elementos.btnConfirmarVoto instanceof HTMLButtonElement) {
    elementos.btnConfirmarVoto.disabled = bloquear;
  }
  if (elementos.btnNovaIdentidade instanceof HTMLButtonElement) {
    elementos.btnNovaIdentidade.disabled = isAcaoEmAndamento;
  }
  if (elementos.selectUf instanceof HTMLSelectElement) {
    elementos.selectUf.disabled = bloquear;
  }
  if (elementos.identificador instanceof HTMLInputElement) {
    elementos.identificador.disabled = isAcaoEmAndamento;
  }
  document.querySelectorAll("[data-candidato]").forEach((botao) => {
    if (botao instanceof HTMLButtonElement) {
      botao.disabled = bloquear;
    }
  });
}

/**
 * Executa uma ação assíncrona bloqueando a UI até terminar.
 * @param {() => Promise<void>} acao
 * @returns {Promise<void>}
 */
async function comUiBloqueada(acao) {
  if (isAcaoEmAndamento) {
    return;
  }
  isAcaoEmAndamento = true;
  atualizarControlesInterativos();
  try {
    await acao();
  } finally {
    isAcaoEmAndamento = false;
    atualizarControlesInterativos();
  }
}

function preencherSeletorUf() {
  const select = /** @type {HTMLSelectElement | null} */ (elementos.selectUf);
  if (!select) {
    return;
  }
  for (const [sigla, nome] of Object.entries(NOMES_UF)) {
    const option = document.createElement("option");
    option.value = sigla;
    option.textContent = `${sigla} — ${nome}`;
    select.appendChild(option);
  }
}

function ligarEventosUi() {
  elementos.btnHabilitar?.addEventListener("click", aoHabilitar);
  elementos.btnRevelarChave?.addEventListener("click", aoRevelarChave);
  elementos.btnNovaIdentidade?.addEventListener("click", aoNovaIdentidadeLocal);
  elementos.btnConfirmarVoto?.addEventListener("click", aoConfirmarVoto);
  elementos.selectUf?.addEventListener("change", () => {
    const valor = /** @type {HTMLSelectElement} */ (elementos.selectUf).value;
    if (!valor) {
      return;
    }
    definirTexto(elementos.statusUrna, `UF selecionada: ${valor}.`);
  });

  document.querySelectorAll("[data-candidato]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const valor = Number(botao.getAttribute("data-candidato"));
      if (!ehCodigoVotoValido(valor)) {
        return;
      }
      candidatoSelecionado = valor;
      document.querySelectorAll("[data-candidato]").forEach((el) => {
        el.classList.toggle("is-selected", el === botao);
      });
      const rotulo =
        valor === 0
          ? NOMES_CANDIDATOS[0]
          : `${valor} — ${NOMES_CANDIDATOS[candidatoSelecionado]}`;
      definirTexto(elementos.statusUrna, `Selecionado: ${rotulo}.`);
    });
  });
}

async function aoHabilitar() {
  await comUiBloqueada(async () => {
    try {
      if (isVotacaoEncerrada) {
        throw new Error("A votação foi encerrada. Não é mais possível habilitar ou votar.");
      }
      if (!ethers) {
        throw new Error("Biblioteca ethers ainda não carregou.");
      }
      const identificador = /** @type {HTMLInputElement} */ (elementos.identificador).value;
      identidadeAtual = montarIdentidade(ethers, identificador);
      atualizarPainelIdentidade(identidadeAtual, null);

      definirTexto(elementos.statusIdentidade, "Assinando e enviando habilitação ao Relayer...");
      const assinatura = await assinarHabilitacao(
        ethers,
        identidadeAtual.carteira,
        identidadeAtual.hashIdentidade
      );

      const { txHash } = await enviarAoRelayer("habilitar", {
        eleitor: identidadeAtual.enderecoPublico,
        hashIdentidade: identidadeAtual.hashIdentidade,
        assinatura,
      });

      definirTexto(
        elementos.statusIdentidade,
        `Habilitado. Transação: ${txHash.slice(0, 10)}…`
      );

      if (contrato) {
        const saldo = await lerSaldoToken(contrato, identidadeAtual.enderecoPublico);
        atualizarPainelIdentidade(identidadeAtual, saldo);
        await atualizarPlacar();
      } else {
        atualizarPainelIdentidade(identidadeAtual, 1);
      }
    } catch (erro) {
      if (identidadeAtual) {
        definirTexto(elementos.saldoToken, "—");
        elementos.saldoToken?.classList.remove("token-ativo", "token-queimado");
      }
      definirTexto(
        elementos.statusIdentidade,
        mensagemErro(erro, "Falha ao habilitar eleitor."),
        { isErro: true }
      );
    }
  });
}

function aoNovaIdentidadeLocal() {
  const confirmado = window.confirm(
    "Isso apaga a chave privada deste navegador e limpa a tela.\n\n" +
      "O histórico na Sepolia NÃO some: identificadores e carteiras já usados no contrato atual continuam bloqueados.\n\n" +
      "Para recomeçar do zero no contrato, use um identificador novo (ou faça redeploy)."
  );
  if (!confirmado) {
    return;
  }

  limparCarteiraLocal();
  identidadeAtual = null;
  candidatoSelecionado = null;

  const input = /** @type {HTMLInputElement | null} */ (elementos.identificador);
  if (input) {
    input.value = "";
  }
  const select = /** @type {HTMLSelectElement | null} */ (elementos.selectUf);
  if (select) {
    select.value = "";
  }

  definirTexto(elementos.enderecoPublico, "—");
  const campoChave = /** @type {HTMLElement | null} */ (elementos.chavePrivada);
  if (campoChave) {
    campoChave.textContent = "••••••••••••••••••••••••••••••••";
    campoChave.dataset.revelada = "false";
  }
  if (elementos.btnRevelarChave) {
    elementos.btnRevelarChave.textContent = "Revelar chave privada";
  }

  definirTexto(elementos.saldoToken, "—");
  elementos.saldoToken?.classList.remove("token-ativo", "token-queimado");
  document.querySelectorAll("[data-candidato]").forEach((el) => {
    el.classList.remove("is-selected");
  });
  definirTexto(elementos.statusUrna, "Selecione um candidato e a UF.");
  definirTexto(
    elementos.statusIdentidade,
    "Identidade local apagada. Informe um identificador NOVO e habilite novamente."
  );
}

function aoRevelarChave() {
  if (!identidadeAtual) {
    definirTexto(elementos.statusIdentidade, "Habilite-se primeiro para gerar a carteira.");
    return;
  }
  const campo = /** @type {HTMLElement} */ (elementos.chavePrivada);
  const estaOculta = campo.dataset.revelada !== "true";
  if (estaOculta) {
    campo.textContent = identidadeAtual.chavePrivada;
    campo.dataset.revelada = "true";
    /** @type {HTMLElement} */ (elementos.btnRevelarChave).textContent = "Ocultar chave privada";
  } else {
    campo.textContent = "••••••••••••••••••••••••••••••••";
    campo.dataset.revelada = "false";
    /** @type {HTMLElement} */ (elementos.btnRevelarChave).textContent = "Revelar chave privada";
  }
}

async function aoConfirmarVoto() {
  await comUiBloqueada(async () => {
    try {
      if (isVotacaoEncerrada) {
        throw new Error("A votação foi encerrada. Não é mais possível habilitar ou votar.");
      }
      if (!ethers || !identidadeAtual) {
        throw new Error("Habilite sua identidade criptográfica antes de votar.");
      }
      if (candidatoSelecionado === null) {
        throw new Error('Selecione 13 (Lula), 22 (Flávio Bolsonaro) ou Branco/Nulo.');
      }
      const ufSelecionada = obterUfSelecionada(
        /** @type {HTMLSelectElement} */ (elementos.selectUf).value
      );

      definirTexto(elementos.statusUrna, "Assinando voto e enviando ao Relayer...");
      const assinatura = await assinarVoto(
        ethers,
        identidadeAtual.carteira,
        candidatoSelecionado,
        ufSelecionada
      );

      const { txHash } = await enviarAoRelayer("votar", {
        eleitor: identidadeAtual.enderecoPublico,
        candidato: candidatoSelecionado,
        uf: ufSelecionada,
        assinatura,
      });

      definirTexto(
        elementos.statusUrna,
        `Voto registrado. Transação: ${txHash.slice(0, 10)}…`
      );

      if (contrato) {
        const saldo = await lerSaldoToken(contrato, identidadeAtual.enderecoPublico);
        atualizarPainelIdentidade(identidadeAtual, saldo);
        await atualizarPlacar();
      } else {
        atualizarPainelIdentidade(identidadeAtual, 0);
      }
    } catch (erro) {
      definirTexto(elementos.statusUrna, mensagemErro(erro, "Falha ao registrar o voto."), {
        isErro: true,
      });
    }
  });
}

/**
 * @param {NonNullable<typeof identidadeAtual>} identidade
 * @param {number | null} saldo
 */
function atualizarPainelIdentidade(identidade, saldo) {
  definirTexto(elementos.enderecoPublico, identidade.enderecoPublico);
  if (saldo === null) {
    definirTexto(elementos.saldoToken, "Consultando…");
    elementos.saldoToken?.classList.remove("token-ativo", "token-queimado");
    return;
  }
  if (saldo === 1) {
    definirTexto(elementos.saldoToken, "1 Token VOTO");
    elementos.saldoToken?.classList.add("token-ativo");
    elementos.saldoToken?.classList.remove("token-queimado");
  } else {
    definirTexto(elementos.saldoToken, "0 Token VOTO — Queimado");
    elementos.saldoToken?.classList.add("token-queimado");
    elementos.saldoToken?.classList.remove("token-ativo");
  }
}

async function atualizarPlacar() {
  if (!contrato) {
    return;
  }
  const totais = await lerTotais(contrato);
  definirTexto(elementos.totalBranco, String(totais.branco));
  definirTexto(elementos.total13, String(totais.lula));
  definirTexto(elementos.total22, String(totais.bolsonaro));
}

/**
 * @param {{eleitor: string, candidato: number, uf: string, timestamp: number, txHash: string}} voto
 */
function adicionarVotoNaTabela(voto) {
  const tbody = elementos.tabelaVotos;
  if (!tbody) {
    return;
  }
  if (tbody.querySelector(`[data-tx="${voto.txHash}"]`)) {
    return;
  }

  const tr = document.createElement("tr");
  tr.dataset.tx = voto.txHash;
  const link = `${CONFIG.ETHERSCAN_TX_BASE}${voto.txHash}`;
  const quando = new Date(voto.timestamp * 1000).toLocaleString("pt-BR");

  tr.innerHTML = `
    <td><a href="${link}" target="_blank" rel="noopener noreferrer">${voto.txHash.slice(0, 10)}…</a></td>
    <td>${voto.uf}</td>
    <td>${formatarVoto(voto.candidato)}</td>
    <td>${voto.eleitor.slice(0, 8)}…</td>
    <td>${quando}</td>
    <td>Token queimado</td>
  `;
  tbody.prepend(tr);
}

/**
 * @param {number} codigo
 * @returns {boolean}
 */
function ehCodigoVotoValido(codigo) {
  return codigo === 0 || CODIGOS_CANDIDATOS.includes(codigo);
}

/**
 * @param {number} codigo
 * @returns {string}
 */
function formatarVoto(codigo) {
  const nome = NOMES_CANDIDATOS[codigo];
  if (!nome) {
    return String(codigo);
  }
  if (codigo === 0) {
    return nome;
  }
  return `${codigo} — ${nome}`;
}

/**
 * @param {HTMLElement | null} elemento
 * @param {string} texto
 * @param {{ isErro?: boolean }} [opcoes]
 */
function definirTexto(elemento, texto, opcoes = {}) {
  if (!elemento) {
    return;
  }
  elemento.textContent = texto;
  elemento.classList.toggle("status-erro", Boolean(opcoes.isErro));
}

/**
 * @param {unknown} erro
 * @param {string} fallback
 * @returns {string}
 */
function mensagemErro(erro, fallback) {
  if (!(erro instanceof Error)) {
    return fallback;
  }
  if (erro.message === "Failed to fetch" || erro.name === "TypeError") {
    return "Não foi possível contatar o Relayer. Inicie o Worker (`cd worker && npm run dev`) e confira RELAYER_URL.";
  }
  return resumirErroOnChain(erro.message) || fallback;
}

iniciarAplicacao().catch((erro) => {
  console.error(erro);
  definirTexto(
    elementos.statusIdentidade,
    erro instanceof Error ? erro.message : "Falha ao iniciar a aplicação."
  );
});
