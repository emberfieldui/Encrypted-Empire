import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { deployments, ethers, fhevm } from "hardhat";

import { EncryptedEmpireGame } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("EncryptedEmpireGameSepolia", function () {
  let signers: Signers;
  let contract: EncryptedEmpireGame;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("EncryptedEmpireGame");
      contractAddress = deployment.address;
      contract = await ethers.getContractAt("EncryptedEmpireGame", contractAddress);
    } catch (error) {
      (error as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw error;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("joins if needed and moves right once", async function () {
    steps = 8;
    await fhevm.initializeCLIApi();

    const hasJoined = await contract.hasJoined(signers.alice.address);

    if (!hasJoined) {
      progress("Encrypting start coordinates (1,1)...");
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add32(1)
        .add32(1)
        .encrypt();

      progress("Calling joinGame...");
      const joinTx = await contract
        .connect(signers.alice)
        .joinGame(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
      await joinTx.wait();
    }

    progress("Encrypting move direction (right)...");
    const moveInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(3)
      .encrypt();

    progress("Calling move...");
    const moveTx = await contract.connect(signers.alice).move(moveInput.handles[0], moveInput.inputProof);
    await moveTx.wait();

    progress("Fetching encrypted position...");
    const [encryptedX, encryptedY] = await contract.getPlayerPosition(signers.alice.address);

    progress("Decrypting X coordinate...");
    const clearX = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedX,
      contractAddress,
      signers.alice,
    );

    progress("Decrypting Y coordinate...");
    const clearY = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedY,
      contractAddress,
      signers.alice,
    );

    progress(`Updated coordinates => (${clearX}, ${clearY})`);
    expect(clearX).to.be.greaterThanOrEqual(1);
    expect(clearX).to.be.lessThanOrEqual(10);
    expect(clearY).to.be.greaterThanOrEqual(1);
    expect(clearY).to.be.lessThanOrEqual(10);
  });
});
