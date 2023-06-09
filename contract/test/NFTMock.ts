/* eslint-disable node/no-missing-import */
/* eslint-disable no-unused-expressions */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { NFTMock } from "../typechain";

const _INTERFACE_ID_ERC721 = "0x80ac58cd";
const _INTERFACE_ID_ERC721_METADATA = "0x5b5e139f";
const _INTERFACE_ID_ERC165 = "0x01ffc9a7";
const _INTERFACE_WITH_PERMIT = "0x5604e225";

describe("NFTMockWithPermit", () => {
  let deployer: SignerWithAddress,
    bob: SignerWithAddress,
    alice: SignerWithAddress;
  let chainId: number;
  let contract: NFTMock;

  // helper to sign using (spender, tokenId, nonce, deadline) EIP 712
  async function sign(
    spender: String,
    tokenId: number,
    nonce: BigNumber,
    deadline: number,
    signer: any
  ) {
    const typedData = {
      types: {
        Permit: [
          { name: "spender", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit",
      domain: {
        name: await contract.name(),
        version: "1",
        chainId: chainId,
        verifyingContract: contract.address,
      },
      message: {
        spender,
        tokenId,
        nonce,
        deadline,
      },
    };

    // sign Permit
    const signature = await signer._signTypedData(
      typedData.domain,
      { Permit: typedData.types.Permit },
      typedData.message
    );

    return signature;
  }

  before(async () => {
    [deployer, bob, alice] = await ethers.getSigners();

    // get chainId
    chainId = await ethers.provider.getNetwork().then((n) => n.chainId);
  });

  beforeEach(async () => {
    // await deployments.fixture();

    // const NFTMock = await ethers.getContractFactory("NFTMock");
    // contract = await NFTMock.deploy();
    // await contract.deployed();

    const NFTMock = await ethers.getContractFactory("NFTMock");
    contract = await upgrades.deployProxy(NFTMock, []);
    await contract.deployed();

    // mint tokenId 1  to deployer
    await contract.mint();

    // transfer to Alice
    await contract.transferFrom(
      await deployer.getAddress(),
      await alice.getAddress(),
      1
    );
  });

  describe("Interfaces", async function () {
    it("has all the right interfaces", async function () {
      const interfaces = [
        _INTERFACE_ID_ERC721,
        _INTERFACE_ID_ERC721_METADATA,
        _INTERFACE_ID_ERC165,
        _INTERFACE_WITH_PERMIT,
      ];
      for (const iface of interfaces) {
        expect(await contract.supportsInterface(iface)).to.be.true;
      }
    });
  });
  describe("Permit", async function () {
    it("nonce increments after each transfer", async function () {
      expect(await contract.nonces(1)).to.be.equal(1);

      await contract
        .connect(alice)
        .transferFrom(await alice.getAddress(), await bob.getAddress(), 1);

      expect(await contract.nonces(1)).to.be.equal(2);

      await contract
        .connect(bob)
        .transferFrom(await bob.getAddress(), await deployer.getAddress(), 1);

      expect(await contract.nonces(1)).to.be.equal(3);
    });

    it("can use permit to get approved", async function () {
      // set deadline in 7 days
      const deadline = Math.round(Date.now() / 1000 + 7 * 24 * 60 * 60);

      // sign Permit for deoloyer
      const signature = await sign(
        await deployer.getAddress(),
        1,
        await contract.nonces(1),
        deadline,
        alice
      );

      // verify that deployer is not approved before permit is used
      expect(await contract.getApproved(1)).to.not.equal(
        await deployer.getAddress()
      );

      // use permit
      await contract
        .connect(deployer)
        .permit(await deployer.getAddress(), 1, deadline, signature);

      // verify that now deoloyer is approved
      expect(await contract.getApproved(1)).to.be.equal(
        await deployer.getAddress()
      );
    });

    it("can not use a permit after a transfer (cause nonce does not match)", async function () {
      // set deadline in 7 days
      const deadline = Math.round(Date.now() / 1000 + 7 * 24 * 60 * 60);

      // sign Permit for deployer
      const signature = await sign(
        await deployer.getAddress(),
        1,
        await contract.nonces(1),
        deadline,
        alice
      );

      // first transfer to bob
      await contract
        .connect(alice)
        .transferFrom(await alice.getAddress(), await bob.getAddress(), 1);

      // then send back to deployer so owner is right (but nonce won't be)
      await contract
        .connect(bob)
        .transferFrom(await bob.getAddress(), await alice.getAddress(), 1);

      // then try to use permit, should throw because nonce is not valid anymore
      await expect(
        contract.permit(await alice.getAddress(), 1, deadline, signature)
      ).to.be.revertedWith("ERC721Permit: invalid signature");
    });

    it("can not use a permit with right nonce but wrong owner", async function () {
      // set deadline in 7 days
      const deadline = Math.round(Date.now() / 1000 + 7 * 24 * 60 * 60);

      // sign Permit for bob
      // Permit will be signed using deployer account, so nonce is right, but owner isn't
      const signature = await sign(
        await deployer.getAddress(),
        1,
        BigNumber.from(1), // nonce is one here
        deadline,
        bob
      );

      // then try to use permit, should throw because owner is wrong
      await expect(
        contract.permit(await deployer.getAddress(), 1, deadline, signature)
      ).to.be.revertedWith("ERC721Permit: invalid signature");
    });

    it("can not use a permit expired", async function () {
      // set deadline 7 days in the past
      const deadline = Math.round(Date.now() / 1000 - 7 * 24 * 60 * 60);

      // sign Permit for bob
      // this Permit is expired as deadline is in the past
      const signature = await sign(
        await deployer.getAddress(),
        1,
        await contract.nonces(1),
        deadline,
        alice
      );

      await expect(
        contract.permit(await deployer.getAddress(), 1, deadline, signature)
      ).to.be.revertedWith("ERC721PermitUpgradeable: expired deadline");
    });

    it("approved / approvedForAll accounts can create valid permits", async function () {
      // set deadline in 7 days
      const deadline = Math.round(Date.now() / 1000 + 7 * 24 * 60 * 60);

      // get a signature from deployer for bob
      // sign Permit for bob
      const signature = await sign(
        await deployer.getAddress(),
        1,
        BigNumber.from(1),
        deadline,
        alice
      );

      // Bob tries to use signature, it should fail because deployer is not approved
      await expect(
        contract
          .connect(bob)
          .permit(await bob.getAddress(), 1, deadline, signature)
      ).to.be.revertedWith("ERC721Permit: invalid signature");

      // alice approves deployer
      await contract
        .connect(alice)
        .setApprovalForAll(await deployer.getAddress(), true);

      // now usin the permit should work because deployer is approvedForAll on Alices tokens
      await contract
        .connect(bob)
        .permit(await bob.getAddress(), 1, deadline, signature);

      // bob should now be approved on tokenId one
      expect(await contract.getApproved(1)).to.be.equal(await bob.getAddress());
    });

    it("can use permit to get approved and transfer in the same tx (safeTransferwithPermit)", async function () {
      // set deadline in 7 days
      const deadline = Math.round(Date.now() / 1000 + 7 * 24 * 60 * 60);

      // sign Permit for deployer
      const signature = await sign(
        await deployer.getAddress(),
        1,
        await contract.nonces(1),
        deadline,
        alice
      );

      expect(await contract.getApproved(1)).to.not.equal(
        await deployer.getAddress()
      );

      await contract
        .connect(deployer)
        .safeTransferFromWithPermit(
          await alice.getAddress(),
          await deployer.getAddress(),
          1,
          [],
          deadline,
          signature
        );

      expect(await contract.ownerOf(1)).to.be.equal(
        await deployer.getAddress()
      );
    });

    it("can not use permit to get approved and transfer in the same tx if wrong sender", async function () {
      // set deadline in 7 days
      const deadline = Math.round(Date.now() / 1000 + 7 * 24 * 60 * 60);

      // sign Permit for bob
      const signature = await sign(
        await deployer.getAddress(),
        1,
        await contract.nonces(1),
        deadline,
        alice
      );

      // try to use permit for bob with Alice account, fails.
      await expect(
        contract
          .connect(bob)
          .safeTransferFromWithPermit(
            await alice.getAddress(),
            await deployer.getAddress(),
            1,
            [],
            deadline,
            signature
          )
      ).to.be.revertedWith(
        "AccessControl: account " +
          (await bob.getAddress()).toLowerCase() +
          " is missing role 0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775"
      );
    });
  });
});
