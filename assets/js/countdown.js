/**
 * Formata segundos restantes em Dd HH:MM:SS ou HH:MM:SS.
 * @param {number} totalSegundos
 * @returns {string}
 */
export function formatarRestante(totalSegundos) {
  const segundos = Math.max(0, Math.floor(totalSegundos));
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segs = segundos % 60;
  const hh = String(horas).padStart(2, "0");
  const mm = String(minutos).padStart(2, "0");
  const ss = String(segs).padStart(2, "0");
  if (dias > 0) {
    return `${dias}d ${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}

/**
 * Inicia o contador até o fim da votação.
 * @param {object} opcoes
 * @param {number} opcoes.fimUnix Timestamp unix do encerramento
 * @param {HTMLElement | null} opcoes.elementoRestante
 * @param {HTMLElement | null} opcoes.elementoRotulo
 * @param {(encerrada: boolean) => void} opcoes.aoMudarEstado
 * @returns {() => void} Função para parar o intervalo
 */
export function iniciarContador({
  fimUnix,
  elementoRestante,
  elementoRotulo,
  aoMudarEstado,
}) {
  let estavaEncerrada = null;

  const tick = () => {
    const agora = Math.floor(Date.now() / 1000);
    const restante = fimUnix - agora;
    const encerrada = restante <= 0;

    if (elementoRestante) {
      elementoRestante.textContent = encerrada ? "00:00:00" : formatarRestante(restante);
      elementoRestante.classList.toggle("contador-encerrado", encerrada);
    }
    if (elementoRotulo) {
      elementoRotulo.textContent = encerrada
        ? "Votação encerrada"
        : "Tempo restante até o encerramento";
    }
    if (estavaEncerrada !== encerrada) {
      estavaEncerrada = encerrada;
      aoMudarEstado(encerrada);
    }
  };

  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}
