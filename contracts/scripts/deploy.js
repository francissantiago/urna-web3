const hre = require("hardhat");

async function main() {
  const Contrato = await hre.ethers.getContractFactory("EleicaoSegundoTurno");
  const contrato = await Contrato.deploy();
  await contrato.waitForDeployment();

  const endereco = await contrato.getAddress();
  console.log("EleicaoSegundoTurno implantado em:", endereco);
  console.log("Atualize CONTRACT_ADDRESS em assets/js/config.js com este valor.");
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
