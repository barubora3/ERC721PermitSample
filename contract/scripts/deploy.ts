// テストネット
// npx hardhat run scripts/deploy.ts --network sepolia
// npx hardhat run scripts/deploy.ts --network goerli
// メインネット
// npx hardhat run scripts/deploy.ts --network mainnet

// Verify
// テストネット
// npx hardhat verify --network sepolia  0x82864E267866dfDa68b2650325E9a80c6d2a48bC
// npx hardhat verify --network goerli  0x61d5eE64b2308beE9ae5aE578B99e078ADc400e8
// メインネット
// npx hardhat verify --network mainnet  0x000000000000000000000000000000000000

const { ethers, upgrades } = require("hardhat");

async function main() {
  const Contract = await ethers.getContractFactory("NFTMock");
  console.log("Deploying Contract...");
  const contract = await upgrades.deployProxy(Contract, []);

  await contract.deployed();
  console.log("Contract deployed to:", contract.address);
}

main();
