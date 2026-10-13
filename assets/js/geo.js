import { UFS_VALIDAS } from "./config.js";

/** Nomes oficiais das UFs para o seletor. */
export const NOMES_UF = Object.freeze({
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
});

/**
 * Normaliza e valida a sigla da UF escolhida pelo eleitor.
 * @param {string} ufBruta
 * @returns {string}
 */
export function normalizarUf(ufBruta) {
  if (typeof ufBruta !== "string") {
    throw new Error("UF inválida.");
  }
  const uf = ufBruta.trim().toUpperCase();
  if (uf.length !== 2) {
    throw new Error("Selecione a UF do eleitor.");
  }
  if (!UFS_VALIDAS.includes(uf)) {
    throw new Error(`UF inválida: ${uf}.`);
  }
  return uf;
}

/**
 * Lê a UF do seletor (entrada direta, sem GPS).
 * @param {string} ufSelecionada
 * @returns {string}
 */
export function obterUfSelecionada(ufSelecionada) {
  return normalizarUf(ufSelecionada);
}
