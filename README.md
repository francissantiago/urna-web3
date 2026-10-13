# 🗳️ Eleições Presidenciais Web3 — Simulador de 2º Turno On-Chain

![Solidity](https://img.shields.io/badge/Solidity-%5E0.8.20-363636?style=for-the-badge&logo=solidity)
![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-2535a0?style=for-the-badge&logo=ethereum)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-100%25%20Client--Side-222222?style=for-the-badge&logo=github)
![License](https://img.shields.io/badge/Licen%C3%A7a-MIT-green?style=for-the-badge)

> **E se o segundo turno das eleições presidenciais brasileiras ocorresse em uma blockchain pública?**
> Este projeto é uma Prova de Conceito (PoC) 100% descentralizada e executada no navegador (hospedada via GitHub Pages) que demonstra, de forma prática e transparente, como contratos inteligentes, criptografia assimétrica e tokenização podem ser aplicados a um processo eleitoral auditável em tempo real.

---

## 🎯 Objetivo do Projeto

Demonstrar de forma simplificada e visual os pilares de uma votação baseada em blockchain (**Imutabilidade**, **Transparência**, **Resistência à Censura** e **Prevenção de Gasto Duplo**), permitindo que qualquer pessoa acesse a aplicação sem conhecimento prévio de Web3, gere sua identidade criptográfica e registre seu voto *on-chain*.

---

## ⚙️ Como Funciona (Fluxo do Eleitor)

O sistema opera através de um ciclo de vida de token único (**Mint & Burn**) combinado com validação geográfica de privacidade preservada:

```mermaid
sequenceDiagram
    autonumber
    actor Eleitor
    participant Front as Front-End (GitHub Pages)
    participant Geo as API de Geolocalização
    participant SC as Smart Contract (Blockchain)

    Eleitor->>Front: Acessa a aplicação e informa identificador único
    Front->>Front: Gera carteira (Chave Pública + Privada) via Ethers.js
    Front->>Front: Cria Hash SHA-256 irreversível (Nullifier Hash)
    Front->>SC: Solicita habilitação (envia Hash + Endereço Público)
    SC-->>SC: Verifica se Identidade ou Carteira já existem
    SC->>Eleitor: Emite (MINT) automaticamente 1 Token VOTO
    Eleitor->>Front: Escolhe candidato e autoriza Geolocalização
    Front->>Geo: Captura coordenadas e converte apenas para UF (ex: SP, MG)
    Front->>SC: Envia transação de Voto assinada com a Chave Privada
    SC-->>SC: Queima (BURN) o Token VOTO do endereço
    SC-->>SC: Computa +1 voto para o candidato e registra na UF
    SC-->>Front: Emite evento público VotoComputado (Auditoria em Tempo Real)