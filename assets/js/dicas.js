/**
 * Liga tooltips didáticos (clique/toque). Azul = mundo real; amarelo = blockchain.
 * Os balões usam position:fixed para não serem cortados por overflow dos painéis.
 */
export function ligarDicas() {
  document.querySelectorAll(".dica").forEach((dica) => {
    const botao = dica.querySelector(".dica-botao");
    const balao = dica.querySelector(".dica-balao");
    if (!(botao instanceof HTMLButtonElement) || !(balao instanceof HTMLElement)) {
      return;
    }

    botao.addEventListener("click", (evento) => {
      evento.stopPropagation();
      const jaAberta = dica.classList.contains("is-aberta");
      fecharTodasAsDicas();
      if (!jaAberta) {
        abrirDica(dica, botao, balao);
      }
    });

    balao.addEventListener("click", (evento) => {
      evento.stopPropagation();
    });
  });

  document.addEventListener("click", () => {
    fecharTodasAsDicas();
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      fecharTodasAsDicas();
    }
  });

  window.addEventListener(
    "resize",
    () => {
      const aberta = document.querySelector(".dica.is-aberta");
      if (!(aberta instanceof HTMLElement)) {
        return;
      }
      const botao = aberta.querySelector(".dica-botao");
      const balao = aberta.querySelector(".dica-balao");
      if (botao instanceof HTMLElement && balao instanceof HTMLElement) {
        posicionarBalao(botao, balao);
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      fecharTodasAsDicas();
    },
    { passive: true }
  );
}

/**
 * @param {HTMLElement} dica
 * @param {HTMLElement} botao
 * @param {HTMLElement} balao
 */
function abrirDica(dica, botao, balao) {
  dica.classList.add("is-aberta");
  botao.setAttribute("aria-expanded", "true");
  balao.hidden = false;
  posicionarBalao(botao, balao);
}

/**
 * Posiciona o balão abaixo do ícone, corrigindo bordas da viewport.
 * @param {HTMLElement} botao
 * @param {HTMLElement} balao
 */
function posicionarBalao(botao, balao) {
  const margem = 8;
  const rect = botao.getBoundingClientRect();
  const largura = Math.min(320, window.innerWidth - margem * 2);

  balao.style.position = "fixed";
  balao.style.width = `${largura}px`;
  balao.style.left = "0px";
  balao.style.top = "0px";
  balao.style.right = "auto";
  balao.style.transform = "none";
  balao.style.display = "block";

  // Mede depois de tornar visível
  const altura = balao.offsetHeight;
  let left = rect.left + rect.width / 2 - largura / 2;
  let top = rect.bottom + margem;

  if (left < margem) {
    left = margem;
  }
  if (left + largura > window.innerWidth - margem) {
    left = window.innerWidth - margem - largura;
  }

  // Se não cabe abaixo, abre acima
  if (top + altura > window.innerHeight - margem) {
    top = Math.max(margem, rect.top - altura - margem);
    balao.dataset.lado = "acima";
  } else {
    balao.dataset.lado = "abaixo";
  }

  balao.style.left = `${left}px`;
  balao.style.top = `${top}px`;

  // Seta alinhada ao centro do botão
  const setaX = rect.left + rect.width / 2 - left;
  balao.style.setProperty("--seta-x", `${setaX}px`);
}

function fecharTodasAsDicas() {
  document.querySelectorAll(".dica.is-aberta").forEach((dica) => {
    dica.classList.remove("is-aberta");
    const botao = dica.querySelector(".dica-botao");
    const balao = dica.querySelector(".dica-balao");
    if (botao) {
      botao.setAttribute("aria-expanded", "false");
    }
    if (balao instanceof HTMLElement) {
      balao.style.display = "none";
      balao.removeAttribute("data-lado");
    }
  });
}
