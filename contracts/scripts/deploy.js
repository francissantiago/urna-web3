const hre = require("hardhat");

/** 25/10/2026 17:00 horário de Brasília (UTC-3). */
const FIM_PADRAO_BRT = 1792958400;

async function main() {
  const fimVotacao = BigInt(process.env.FIM_VOTACAO_UNIX || FIM_PADRAO_BRT);
  const agora = BigInt(Math.floor(Date.now() / 1000));

  if (fimVotacao <= agora) {
    throw new Error(
      `FIM_VOTACAO_UNIX (${fimVotacao}) precisa ser no futuro. Agora: ${agora}.`
    );
  }

  const Contrato = await hre.ethers.getContractFactory("EleicaoSegundoTurno");
  const contrato = await Contrato.deploy(fimVotacao);
  await contrato.waitForDeployment();

  const endereco = await contrato.getAddress();
  const fimLido = await contrato.fimVotacao();
  const fimDate = new Date(Number(fimLido) * 1000);

  console.log("EleicaoSegundoTurno implantado em:", endereco);
  console.log(
    "Fim da votação (UTC):",
    fimDate.toISOString(),
    "| Brasília:",
    fimDate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
  );
  console.log("Atualize CONTRACT_ADDRESS em assets/js/config.js com este valor.");
  console.log("Atualize o secret CONTRACT_ADDRESS do Worker (wrangler secret put).");
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
