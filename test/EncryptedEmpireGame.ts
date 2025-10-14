import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { EncryptedEmpireGame, EncryptedEmpireGame__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedEmpireGame")) as EncryptedEmpireGame__factory;
  const contract = (await factory.deploy()) as EncryptedEmpireGame;
  const address = await contract.getAddress();

  return { contract, address };
}

describe("EncryptedEmpireGame", function () {
  let signers: Signers;
  let contract: EncryptedEmpireGame;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, address: contractAddress } = await deployFixture());
  });

  async function decryptPosition(player: HardhatEthersSigner) {
    const [encryptedX, encryptedY] = await contract.getPlayerPosition(player.address);

    const x = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedX, contractAddress, player);
    const y = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedY, contractAddress, player);

    return { x, y };
  }

  async function joinWithClearCoords(player: HardhatEthersSigner, x: number, y: number) {
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, player.address)
      .add32(x)
      .add32(y)
      .encrypt();

    const tx = await contract
      .connect(player)
      .joinGame(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
    await tx.wait();
  }

  async function moveInDirection(player: HardhatEthersSigner, direction: number) {
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, player.address)
      .add32(direction)
      .encrypt();

    const tx = await contract.connect(player).move(encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();
  }

  it("stores encrypted coordinates on join", async function () {
    const startX = 4;
    const startY = 7;

    await joinWithClearCoords(signers.alice, startX, startY);

    const { x, y } = await decryptPosition(signers.alice);
    expect(x).to.eq(startX);
    expect(y).to.eq(startY);
  });

  it("moves a player within boundaries", async function () {
    await joinWithClearCoords(signers.alice, 5, 5);

    // up
    await moveInDirection(signers.alice, 0);
    let position = await decryptPosition(signers.alice);
    expect(position).to.deep.eq({ x: 5, y: 6 });

    // right
    await moveInDirection(signers.alice, 3);
    position = await decryptPosition(signers.alice);
    expect(position).to.deep.eq({ x: 6, y: 6 });

    // down
    await moveInDirection(signers.alice, 1);
    position = await decryptPosition(signers.alice);
    expect(position).to.deep.eq({ x: 6, y: 5 });

    // left
    await moveInDirection(signers.alice, 2);
    position = await decryptPosition(signers.alice);
    expect(position).to.deep.eq({ x: 5, y: 5 });

    // attempt to move outside bounds
    for (let i = 0; i < 10; i++) {
      await moveInDirection(signers.alice, 2); // left towards min bound 1
    }
    position = await decryptPosition(signers.alice);
    expect(position.x).to.eq(1);

    for (let i = 0; i < 10; i++) {
      await moveInDirection(signers.alice, 1); // down towards min bound 1
    }
    position = await decryptPosition(signers.alice);
    expect(position.y).to.eq(1);

    for (let i = 0; i < 10; i++) {
      await moveInDirection(signers.alice, 3); // right towards max bound 10
    }
    position = await decryptPosition(signers.alice);
    expect(position.x).to.eq(10);

    for (let i = 0; i < 10; i++) {
      await moveInDirection(signers.alice, 0); // up towards max bound 10
    }
    position = await decryptPosition(signers.alice);
    expect(position.y).to.eq(10);
  });
});
