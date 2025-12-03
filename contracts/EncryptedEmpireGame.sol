// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedEmpireGame is ZamaEthereumConfig {
    uint32 private constant GRID_MIN = 1;
    uint32 private constant GRID_MAX = 10;

    struct PlayerState {
        euint32 x;
        euint32 y;
        bool joined;
    }

    mapping(address => PlayerState) private _players;
    address[] private _playerIndex;

    event PlayerJoined(address indexed account, euint32 x, euint32 y);
    event PlayerMoved(address indexed account, euint32 x, euint32 y);

    function joinGame(
        externalEuint32 encryptedX,
        externalEuint32 encryptedY,
        bytes calldata inputProof
    ) external {
        PlayerState storage player = _players[msg.sender];
        require(!player.joined, "Player already joined");

        euint32 x = FHE.fromExternal(encryptedX, inputProof);
        euint32 y = FHE.fromExternal(encryptedY, inputProof);

        x = FHE.allowThis(x);
        x = FHE.allow(x, msg.sender);
        y = FHE.allowThis(y);
        y = FHE.allow(y, msg.sender);

        player.x = x;
        player.y = y;
        player.joined = true;
        _playerIndex.push(msg.sender);

        emit PlayerJoined(msg.sender, player.x, player.y);
    }

    function move(externalEuint32 encryptedDirection, bytes calldata directionProof) external {
        PlayerState storage player = _players[msg.sender];
        require(player.joined, "Player not in game");

        euint32 direction = FHE.fromExternal(encryptedDirection, directionProof);

        euint32 minBound = FHE.asEuint32(GRID_MIN);
        euint32 maxBound = FHE.asEuint32(GRID_MAX);
        euint32 step = FHE.asEuint32(1);

        euint32 newX = player.x;
        euint32 newY = player.y;

        ebool goUp = FHE.eq(direction, FHE.asEuint32(0));
        newY = FHE.select(goUp, FHE.min(FHE.add(newY, step), maxBound), newY);

        ebool goDown = FHE.eq(direction, FHE.asEuint32(1));
        newY = FHE.select(goDown, FHE.max(FHE.sub(newY, step), minBound), newY);

        ebool goLeft = FHE.eq(direction, FHE.asEuint32(2));
        newX = FHE.select(goLeft, FHE.max(FHE.sub(newX, step), minBound), newX);

        ebool goRight = FHE.eq(direction, FHE.asEuint32(3));
        newX = FHE.select(goRight, FHE.min(FHE.add(newX, step), maxBound), newX);

        player.x = FHE.allow(FHE.allowThis(newX), msg.sender);
        player.y = FHE.allow(FHE.allowThis(newY), msg.sender);

        emit PlayerMoved(msg.sender, player.x, player.y);
    }

    function getPlayerPosition(address account) external view returns (euint32, euint32) {
        PlayerState storage player = _players[account];
        require(player.joined, "Player not in game");
        return (player.x, player.y);
    }

    function hasJoined(address account) external view returns (bool) {
        return _players[account].joined;
    }

    function gridSize() external pure returns (uint32, uint32) {
        return (GRID_MAX, GRID_MAX);
    }

    function getPlayers() external view returns (address[] memory) {
        return _playerIndex;
    }
}
