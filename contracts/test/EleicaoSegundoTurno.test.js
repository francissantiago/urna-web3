const { expect } = require("chai");
const { ethers, network } = require("hardhat");

/** 25/10/2026 17:00 BRT — usado nos testes como fim padrão. */
const FIM_VOTACAO = 1792958400;

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

async function implantar(fimVotacao = FIM_VOTACAO) {
  const Fabrica = await ethers.getContractFactory("EleicaoSegundoTurno");
  const contrato = await Fabrica.deploy(fimVotacao);
  await contrato.waitForDeployment();
  return contrato;
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
    contrato = await implantar();

    hashA = ethers.id("eleitor-a_SALT_ELEICAO_2026");
    hashB = ethers.id("eleitor-b_SALT_ELEICAO_2026");
  });

  describe("caminho feliz", function () {
    it("grava fimVotacao e mantém votacaoAberta", async function () {
      expect(await contrato.fimVotacao()).to.equal(BigInt(FIM_VOTACAO));
      expect(await contrato.votacaoAberta()).to.equal(true);
    });

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

    it("recusa habilitação e voto após o fim", async function () {
      await habilitar(contrato, relayer, eleitorA, hashA);

      const bloco = await ethers.provider.getBlock("latest");
      const salto = FIM_VOTACAO - Number(bloco.timestamp) + 1;
      await network.provider.send("evm_increaseTime", [salto]);
      await network.provider.send("evm_mine");

      expect(await contrato.votacaoAberta()).to.equal(false);
      await expect(votar(contrato, relayer, eleitorA, 13, "SP")).to.be.revertedWith(
        "Votacao encerrada."
      );
      await expect(habilitar(contrato, relayer, eleitorB, hashB)).to.be.revertedWith(
        "Votacao encerrada."
      );
    });
  });
});
