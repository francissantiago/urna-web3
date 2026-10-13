const { expect } = require("chai");
const { ethers } = require("hardhat");

function montarHashHabilitacao(eleitor, hashIdentidade) {
  return ethers.solidityPackedKeccak256(
    ["string", "address", "bytes32"],
    ["urna-habilitar:", eleitor, hashIdentidade]
  );
}

function montarHashVoto(eleitor, candidato, uf) {
  return ethers.solidityPackedKeccak256(
    ["string", "address", "uint8", "string"],
    ["urna-votar:", eleitor, candidato, uf]
  );
}

async function assinarHash(carteira, hashMensagem) {
  return carteira.signMessage(ethers.getBytes(hashMensagem));
}

async function habilitar(contrato, relayer, eleitor, hashIdentidade) {
  const mensagem = montarHashHabilitacao(eleitor.address, hashIdentidade);
  const assinatura = await assinarHash(eleitor, mensagem);
  return contrato
    .connect(relayer)
    .habilitarEleitor(eleitor.address, hashIdentidade, assinatura);
}

async function votar(contrato, relayer, eleitor, candidato, uf) {
  const mensagem = montarHashVoto(eleitor.address, candidato, uf);
  const assinatura = await assinarHash(eleitor, mensagem);
  return contrato
    .connect(relayer)
    .votar(eleitor.address, candidato, uf, assinatura);
}

describe("EleicaoSegundoTurno", function () {
  let contrato;
  let relayer;
  let eleitorA;
  let eleitorB;
  let hashA;
  let hashB;

  beforeEach(async function () {
    [relayer, eleitorA, eleitorB] = await ethers.getSigners();
    const Fabrica = await ethers.getContractFactory("EleicaoSegundoTurno");
    contrato = await Fabrica.deploy();
    await contrato.waitForDeployment();

    hashA = ethers.id("eleitor-a_SALT_ELEICAO_2026");
    hashB = ethers.id("eleitor-b_SALT_ELEICAO_2026");
  });

  describe("caminho feliz", function () {
    it("habilita eleitor, faz mint de 1 token, queima no voto e conta por UF", async function () {
      await expect(habilitar(contrato, relayer, eleitorA, hashA))
        .to.emit(contrato, "EleitorHabilitado")
        .withArgs(eleitorA.address, 1n);

      expect(await contrato.saldoTokenVoto(eleitorA.address)).to.equal(1n);
      expect(await contrato.carteiraJaHabilitada(eleitorA.address)).to.equal(true);
      expect(await contrato.identidadeJaRegistrada(hashA)).to.equal(true);

      await expect(votar(contrato, relayer, eleitorA, 13, "SP"))
        .to.emit(contrato, "VotoComputado")
        .withArgs(eleitorA.address, 13, "SP", (valor) => valor > 0n);

      expect(await contrato.saldoTokenVoto(eleitorA.address)).to.equal(0n);
      expect(await contrato.totalVotos(13)).to.equal(1n);
      expect(await contrato.votosPorUF("SP", 13)).to.equal(1n);
    });

    it("aceita branco/nulo (0) e Flávio Bolsonaro (22)", async function () {
      await habilitar(contrato, relayer, eleitorA, hashA);
      await votar(contrato, relayer, eleitorA, 0, "MG");
      expect(await contrato.totalVotos(0)).to.equal(1n);

      await habilitar(contrato, relayer, eleitorB, hashB);
      await votar(contrato, relayer, eleitorB, 22, "RJ");
      expect(await contrato.totalVotos(22)).to.equal(1n);
      expect(await contrato.votosPorUF("RJ", 22)).to.equal(1n);
    });
  });

  describe("casos inválidos", function () {
    it("recusa hash de identidade repetido", async function () {
      await habilitar(contrato, relayer, eleitorA, hashA);
      await expect(habilitar(contrato, relayer, eleitorB, hashA)).to.be.revertedWith(
        "Individuo ja recebeu um token de voto."
      );
    });

    it("recusa carteira já registrada", async function () {
      await habilitar(contrato, relayer, eleitorA, hashA);
      await expect(habilitar(contrato, relayer, eleitorA, hashB)).to.be.revertedWith(
        "Este endereco ja foi registrado."
      );
    });

    it("recusa voto sem token", async function () {
      await expect(votar(contrato, relayer, eleitorA, 13, "SP")).to.be.revertedWith(
        "Sem token de voto disponivel (ja votou ou nao habilitado)."
      );
    });

    it("recusa segundo voto após queima", async function () {
      await habilitar(contrato, relayer, eleitorA, hashA);
      await votar(contrato, relayer, eleitorA, 13, "SP");
      await expect(votar(contrato, relayer, eleitorA, 22, "SP")).to.be.revertedWith(
        "Sem token de voto disponivel (ja votou ou nao habilitado)."
      );
    });

    it("recusa candidato fora de 0, 13 e 22", async function () {
      await habilitar(contrato, relayer, eleitorA, hashA);
      await expect(votar(contrato, relayer, eleitorA, 3, "SP")).to.be.revertedWith(
        "Opcao de candidato invalida."
      );
      await expect(votar(contrato, relayer, eleitorA, 15, "SP")).to.be.revertedWith(
        "Opcao de candidato invalida."
      );
    });

    it("recusa UF com tamanho diferente de 2", async function () {
      await habilitar(contrato, relayer, eleitorA, hashA);
      await expect(votar(contrato, relayer, eleitorA, 13, "SAO")).to.be.revertedWith(
        "Informe a sigla da UF com 2 letras."
      );
    });

    it("recusa UF inválida", async function () {
      await habilitar(contrato, relayer, eleitorA, hashA);
      await expect(votar(contrato, relayer, eleitorA, 13, "XX")).to.be.revertedWith(
        "UF invalida."
      );
    });

    it("recusa assinatura de outro eleitor na habilitação", async function () {
      const mensagem = montarHashHabilitacao(eleitorA.address, hashA);
      const assinaturaAlheia = await assinarHash(eleitorB, mensagem);
      await expect(
        contrato
          .connect(relayer)
          .habilitarEleitor(eleitorA.address, hashA, assinaturaAlheia)
      ).to.be.revertedWith("Assinatura invalida.");
    });
  });
});
