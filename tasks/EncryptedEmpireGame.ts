import { FhevmType } from "@fhevm/hardhat-plugin";
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const DIRECTIONS: Record<string, number> = {
  up: 0,
  down: 1,
  left: 2,
  right: 3,
};

task("task:address", "Prints the EncryptedEmpireGame address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("EncryptedEmpireGame");
  console.log("EncryptedEmpireGame address is " + deployment.address);
});

task("task:join", "Encrypt coordinates and join the game")
  .addOptionalParam("address", "Optional EncryptedEmpireGame contract address")
  .addOptionalParam("x", "Initial X coordinate between 1 and 10", undefined, types.int)
  .addOptionalParam("y", "Initial Y coordinate between 1 and 10", undefined, types.int)
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const deployment = taskArguments.address
      ? { address: taskArguments.address as string }
      : await deployments.get("EncryptedEmpireGame");

    const signers = await ethers.getSigners();
    const caller = signers[0];

    const parseCoordinate = (value: unknown): number | undefined => {
      if (value === undefined) {
        return undefined;
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
        throw new Error("Coordinates must be integers between 1 and 10");
      }
      return parsed;
    };

    const x = parseCoordinate(taskArguments.x) ?? Math.floor(Math.random() * 10) + 1;
    const y = parseCoordinate(taskArguments.y) ?? Math.floor(Math.random() * 10) + 1;

    await fhevm.initializeCLIApi();

    const contract = await ethers.getContractAt("EncryptedEmpireGame", deployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, caller.address)
      .add32(x)
      .add32(y)
      .encrypt();

    const tx = await contract
      .connect(caller)
      .joinGame(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);

    console.log(`Joining game at (${x}, ${y}). Waiting for tx ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx ${tx.hash} status=${receipt?.status}`);
  });

task("task:move", "Encrypt a direction and move one step")
  .addParam("direction", "Direction: up, down, left, right")
  .addOptionalParam("address", "Optional EncryptedEmpireGame contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const normalizedDirection = String(taskArguments.direction || "").toLowerCase();
    if (!(normalizedDirection in DIRECTIONS)) {
      throw new Error("Direction must be one of: up, down, left, right");
    }

    const deployment = taskArguments.address
      ? { address: taskArguments.address as string }
      : await deployments.get("EncryptedEmpireGame");

    const signers = await ethers.getSigners();
    const caller = signers[0];

    await fhevm.initializeCLIApi();

    const contract = await ethers.getContractAt("EncryptedEmpireGame", deployment.address);

    const directionValue = DIRECTIONS[normalizedDirection];
    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, caller.address)
      .add32(directionValue)
      .encrypt();

    const tx = await contract
      .connect(caller)
      .move(encryptedInput.handles[0], encryptedInput.inputProof);

    console.log(`Moving ${normalizedDirection}. Waiting for tx ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx ${tx.hash} status=${receipt?.status}`);
  });

task("task:position", "Decrypt a player's current position")
  .addOptionalParam("target", "Player address to inspect")
  .addOptionalParam("address", "Optional EncryptedEmpireGame contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address
      ? { address: taskArguments.address as string }
      : await deployments.get("EncryptedEmpireGame");

    const signers = await ethers.getSigners();
    const caller = signers[0];
    const target = (taskArguments.target as string | undefined) ?? caller.address;

    const contract = await ethers.getContractAt("EncryptedEmpireGame", deployment.address);

    const [encryptedX, encryptedY] = await contract.getPlayerPosition(target);

    const clearX = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedX, deployment.address, caller);
    const clearY = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedY, deployment.address, caller);

    console.log(`Player ${target} position => x: ${clearX}, y: ${clearY}`);
  });
