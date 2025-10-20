import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const encryptedEmpire = await deploy("EncryptedEmpireGame", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedEmpireGame contract: `, encryptedEmpire.address);
};
export default func;
func.id = "deploy_encryptedEmpire"; // id required to prevent reexecution
func.tags = ["EncryptedEmpireGame"];
