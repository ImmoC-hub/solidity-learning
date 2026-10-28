import hre from "hardhat";
import { expect } from "chai";
import { MyToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DECIMALS, MINTING_AMOUNT } from "./constant";

describe("mytoken deploy", () => {
  let myTokenC: MyToken;
  let signers: HardhatEthersSigner[];
  before("should deploy", async () => {
    signers = await hre.ethers.getSigners();
    myTokenC = await hre.ethers.deployContract("MyToken", [
      "MyToken",
      "MT",
      DECIMALS,
      MINTING_AMOUNT,
    ]);
  });
  it("should return name", async () => {
    expect(await myTokenC.name()).equal("MyToken");
  });
  it("should return symbol", async () => {
    expect(await myTokenC.symbol()).equal("MT");
  });
  it("should return decimals", async () => {
    expect(await myTokenC.decimals()).equal(DECIMALS);
  });
    it("should return 0 totalSupply", async () => {
    expect(await myTokenC.totalSupply()).equal(MINTING_AMOUNT * 10n ** DECIMALS);
  });
  it("shoud have 0.5MT", async () => {
    const signer1 = signers[1];
    await myTokenC.transfer(hre.ethers.parseUnits("0.5", DECIMALS), signer1.address);
    expect(await myTokenC.balanceOf(signer1.address)).equal(
      hre.ethers.parseUnits("0.5", DECIMALS)
    );
  });

  describe("Mint", () => {
    before("should deploy", async () => {
      myTokenC = await hre.ethers.deployContract("MyToken", [
        "MyToken",
        "MT",
        DECIMALS,
        MINTING_AMOUNT,
      ]);
    });
    it("should return 1MT balance for signer 0", async () => {
      const signer0 = signers[0];
      expect(await myTokenC.balanceOf(signer0)).equal(
        MINTING_AMOUNT * 10n ** DECIMALS
      );
    });

    it("should return or revert when minting infinitely", async () => {
      const hacker = signers[2];
      const mintingAgainAmount = hre.ethers.parseUnits("10000", DECIMALS);
      await expect(
        myTokenC.connect(hacker).mint(mintingAgainAmount, hacker.address)
      ).to.be.revertedWith("You are not authorized to manage this contract");
    });
  });

  describe("TransferFrom", () => {
    before("should deploy", async () => {
      myTokenC = await hre.ethers.deployContract("MyToken", [
        "MyToken",
        "MT",
        DECIMALS,
        MINTING_AMOUNT,
      ]);
    });
    it("should emit Approval event", async () => {
      const signer1 = signers[1];
      await expect(
        myTokenC.approve(signer1.address, hre.ethers.parseUnits("10", DECIMALS))
      )
        .to.emit(myTokenC, "Approval")
        .withArgs(signer1.address, hre.ethers.parseUnits("10", DECIMALS));
    });
    it("should transfer 0.3MT from signer0 to signer1 by signer1", async () => {
      const signer0 = signers[0];
      const signer1 = signers[1];
      await expect(
        myTokenC
          .connect(signer1)
          .transferFrom(
            signer0.address,
            signer1.address,
            hre.ethers.parseUnits("0.3", DECIMALS)
          )
      )
        .to.emit(myTokenC, "Transfer")
        .withArgs(
          signer0.address,
          signer1.address,
          hre.ethers.parseUnits("0.3", DECIMALS)
        );
    });
    it("should move 0.3MT from signer0 to signer1", async () => {
      expect(await myTokenC.balanceOf(signers[0].address)).equal(
        MINTING_AMOUNT * 10n ** DECIMALS - hre.ethers.parseUnits("0.3", DECIMALS)
      );
      expect(await myTokenC.balanceOf(signers[1].address)).equal(
        hre.ethers.parseUnits("0.3", DECIMALS)
      );
    });
  });
});
