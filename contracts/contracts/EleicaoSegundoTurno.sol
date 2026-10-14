// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EleicaoSegundoTurno
/// @notice PoC de segundo turno com token de voto intransferível (mint & burn).
/// @dev O Relayer paga o gas; a identidade do eleitor vem da assinatura EIP-191,
///      não de msg.sender (que seria o próprio Relayer).
contract EleicaoSegundoTurno {
    // Códigos de legenda: 0 = Branco/Nulo, 13 = Lula, 22 = Flávio Bolsonaro
    mapping(uint8 => uint256) public totalVotos;

    // Votos agrupados por Estado (UF => (Candidato => Quantidade))
    mapping(string => mapping(uint8 => uint256)) public votosPorUF;

    // Controle de Tokens de Voto (1 endereço = 1 token)
    mapping(address => uint256) public saldoTokenVoto;

    // Prevenção de duplicidade: Hash de identidade única já utilizado?
    mapping(bytes32 => bool) public identidadeJaRegistrada;

    // Endereço já foi habilitado?
    mapping(address => bool) public carteiraJaHabilitada;

    /// @notice Encerramento da votação (unix timestamp, fuso de Brasília no deploy).
    uint256 public immutable fimVotacao;

    event EleitorHabilitado(address indexed eleitor, uint256 tokensRecebidos);
    event VotoComputado(
        address indexed eleitor,
        uint8 indexed candidato,
        string uf,
        uint256 timestamp
    );

    /// @param _fimVotacao Timestamp unix do fim (ex.: 25/10/2026 17:00 BRT = 1792958400).
    constructor(uint256 _fimVotacao) {
        require(_fimVotacao > block.timestamp, "Fim da votacao no passado.");
        fimVotacao = _fimVotacao;
    }

    /// @notice Indica se a janela de votação ainda está aberta.
    function votacaoAberta() public view returns (bool) {
        return block.timestamp <= fimVotacao;
    }

    /// @notice Registro único e recebimento automático de 1 Token de Voto.
    /// @param eleitor Endereço da carteira gerada no navegador.
    /// @param hashIdentidadeUnica Nullifier hash gerado no cliente (keccak256).
    /// @param assinatura Assinatura EIP-191 da mensagem de habilitação.
    function habilitarEleitor(
        address eleitor,
        bytes32 hashIdentidadeUnica,
        bytes calldata assinatura
    ) external {
        require(votacaoAberta(), "Votacao encerrada.");
        require(eleitor != address(0), "Eleitor invalido.");
        require(
            !identidadeJaRegistrada[hashIdentidadeUnica],
            "Individuo ja recebeu um token de voto."
        );
        require(
            !carteiraJaHabilitada[eleitor],
            "Este endereco ja foi registrado."
        );
        require(
            _recuperarAssinante(_mensagemHabilitacao(eleitor, hashIdentidadeUnica), assinatura) ==
                eleitor,
            "Assinatura invalida."
        );

        identidadeJaRegistrada[hashIdentidadeUnica] = true;
        carteiraJaHabilitada[eleitor] = true;
        saldoTokenVoto[eleitor] = 1;

        emit EleitorHabilitado(eleitor, 1);
    }

    /// @notice Queima o token e registra o voto on-chain com a UF do eleitor.
    /// @param eleitor Endereço da carteira do eleitor.
    /// @param candidato 0 = Branco/Nulo, 13 = Lula, 22 = Flávio Bolsonaro.
    /// @param uf Sigla do estado com 2 letras em maiúsculas (ex: "SP").
    /// @param assinatura Assinatura EIP-191 da mensagem de voto.
    function votar(
        address eleitor,
        uint8 candidato,
        string calldata uf,
        bytes calldata assinatura
    ) external {
        require(votacaoAberta(), "Votacao encerrada.");
        require(eleitor != address(0), "Eleitor invalido.");
        require(
            saldoTokenVoto[eleitor] == 1,
            "Sem token de voto disponivel (ja votou ou nao habilitado)."
        );
        require(
            candidato == 0 || candidato == 13 || candidato == 22,
            "Opcao de candidato invalida."
        );
        require(bytes(uf).length == 2, "Informe a sigla da UF com 2 letras.");
        require(_ehUfValida(uf), "UF invalida.");
        require(
            _recuperarAssinante(_mensagemVoto(eleitor, candidato, uf), assinatura) == eleitor,
            "Assinatura invalida."
        );

        // BURN antes da escrita para evitar reentrância
        saldoTokenVoto[eleitor] = 0;

        totalVotos[candidato] += 1;
        votosPorUF[uf][candidato] += 1;

        emit VotoComputado(eleitor, candidato, uf, block.timestamp);
    }

    function _mensagemHabilitacao(
        address eleitor,
        bytes32 hashIdentidade
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("urna-habilitar:", eleitor, hashIdentidade));
    }

    function _mensagemVoto(
        address eleitor,
        uint8 candidato,
        string calldata uf
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("urna-votar:", eleitor, candidato, uf));
    }

    /// @dev Recupera o assinante de um hash de mensagem no formato personal_sign (EIP-191).
    function _recuperarAssinante(
        bytes32 hashMensagem,
        bytes calldata assinatura
    ) private pure returns (address) {
        require(assinatura.length == 65, "Assinatura com tamanho invalido.");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(assinatura.offset)
            s := calldataload(add(assinatura.offset, 32))
            v := byte(0, calldataload(add(assinatura.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Versao de assinatura invalida.");

        bytes32 ethSigned = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hashMensagem)
        );
        return ecrecover(ethSigned, v, r, s);
    }

    /// @dev Aceita apenas as 27 unidades federativas brasileiras em maiúsculas.
    function _ehUfValida(string calldata uf) private pure returns (bool) {
        bytes32 h = keccak256(bytes(uf));
        return
            h == keccak256("AC") ||
            h == keccak256("AL") ||
            h == keccak256("AP") ||
            h == keccak256("AM") ||
            h == keccak256("BA") ||
            h == keccak256("CE") ||
            h == keccak256("DF") ||
            h == keccak256("ES") ||
            h == keccak256("GO") ||
            h == keccak256("MA") ||
            h == keccak256("MT") ||
            h == keccak256("MS") ||
            h == keccak256("MG") ||
            h == keccak256("PA") ||
            h == keccak256("PB") ||
            h == keccak256("PR") ||
            h == keccak256("PE") ||
            h == keccak256("PI") ||
            h == keccak256("RJ") ||
            h == keccak256("RN") ||
            h == keccak256("RS") ||
            h == keccak256("RO") ||
            h == keccak256("RR") ||
            h == keccak256("SC") ||
            h == keccak256("SP") ||
            h == keccak256("SE") ||
            h == keccak256("TO");
    }
}
