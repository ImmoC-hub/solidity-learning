import hre from "hardhat";
import { expect } from "chai";
import { DECIMALS, MINTING_AMOUNT } from "./constant";
import { MyToken, TinyBank } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TinyBank", () => {
  let signers: HardhatEthersSigner[];
  let managers: HardhatEthersSigner[];
  let myTokenC: MyToken;
  let tinyBankC: TinyBank;
  beforeEach(async () => {
    signers = await hre.ethers.getSigners();
    managers = [signers[2], signers[3], signers[4]];
    myTokenC = await hre.ethers.deployContract("MyToken", [
      "MyToken",
      "MT",
      DECIMALS,
      MINTING_AMOUNT,
    ]);
    tinyBankC = await hre.ethers.deployContract("TinyBank", [
      await myTokenC.getAddress(),
      managers.map((m) => m.address),
    ]);
    await myTokenC.setManager(tinyBankC.getAddress());
  });

  describe("Initialized state check", () => {
    it("should return totalStaked 0", async () => {
      expect(await tinyBankC.totalStaked()).equal(0);
    });
    it("should return staked 0 amount of signer0", async () => {
      const signer0 = signers[0];
      expect(await tinyBankC.staked(signer0.address)).equal(0);
    });
  });

  describe("Staking", () => {
    it("should return staked amount", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);
      expect(await tinyBankC.staked(signer0.address)).equal(stakingAmount);
      expect(await tinyBankC.totalStaked()).equal(stakingAmount);
      expect(await myTokenC.balanceOf(tinyBankC)).equal(
        await tinyBankC.totalStaked()
      );
    });
  });

  describe("Withdraw", () => {
    it("should return 0 staked after withdrawing total token", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);
      await tinyBankC.withdraw(stakingAmount);
      expect(await tinyBankC.staked(signer0.address)).equal(0);
    });
  });

  describe("reward", () => {
    it("should reward 1MT every blocks", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);

      const BLOCKS = 5n;
      const transferAmount = hre.ethers.parseUnits("1", DECIMALS);
      for (var i = 0; i < BLOCKS; i++) {
        await myTokenC.transfer(transferAmount, signer0.address);
      }

      await tinyBankC.withdraw(stakingAmount);
      expect(await myTokenC.balanceOf(signer0.address)).equal(
        hre.ethers.parseUnits((BLOCKS + MINTING_AMOUNT + 1n).toString())
      );
    });

    it("Should revert when changing rewardPerBlock by hacker", async () => {
      const hacker = signers[1];
      const rewardToChange = hre.ethers.parseUnits("10000", DECIMALS);
      await expect(
        tinyBankC.connect(hacker).setRewardPerBlock(rewardToChange)
      ).to.be.revertedWith("You are not a manager");
    });
  });

  describe("Multi Manager", () => {
    it("should return registered managers", async () => {
      for (var i = 0; i < managers.length; i++) {
        expect(await tinyBankC.managers(i)).equal(managers[i].address);
      }
    });

    it("should revert when deploying with less than 3 managers", async () => {
      await expect(
        hre.ethers.deployContract("TinyBank", [
          await myTokenC.getAddress(),
          [managers[0].address, managers[1].address],
        ])
      ).to.be.revertedWith("At least 3 managers required");
    });

    it("should revert when non-manager confirms", async () => {
      const hacker = signers[1];
      await expect(tinyBankC.connect(hacker).confirm()).to.be.revertedWith(
        "You are not a manager"
      );
    });

    it("should revert when not all managers confirmed", async () => {
      const rewardToChange = hre.ethers.parseUnits("2", DECIMALS);
      await tinyBankC.connect(managers[0]).confirm();
      await tinyBankC.connect(managers[1]).confirm();
      await expect(
        tinyBankC.connect(managers[0]).setRewardPerBlock(rewardToChange)
      ).to.be.revertedWith("Not all confirmed yet");
    });

    it("should revert when hacker changes rewardPerBlock after all confirmed", async () => {
      const hacker = signers[1];
      const rewardToChange = hre.ethers.parseUnits("10000", DECIMALS);
      for (const manager of managers) {
        await tinyBankC.connect(manager).confirm();
      }
      await expect(
        tinyBankC.connect(hacker).setRewardPerBlock(rewardToChange)
      ).to.be.revertedWith("You are not a manager");
    });

    it("should reward 2MT every blocks after all managers confirmed", async () => {
      const signer0 = signers[0];
      const rewardToChange = hre.ethers.parseUnits("2", DECIMALS);
      for (const manager of managers) {
        await tinyBankC.connect(manager).confirm();
      }
      await tinyBankC.connect(managers[0]).setRewardPerBlock(rewardToChange);

      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);

      const BLOCKS = 5n;
      const transferAmount = hre.ethers.parseUnits("1", DECIMALS);
      for (var i = 0; i < BLOCKS; i++) {
        await myTokenC.transfer(transferAmount, signer0.address);
      }

      await tinyBankC.withdraw(stakingAmount);
      expect(await myTokenC.balanceOf(signer0.address)).equal(
        hre.ethers.parseUnits((2n * (BLOCKS + 1n) + MINTING_AMOUNT).toString())
      );
    });

    it("should reset confirmations after rewardPerBlock changed", async () => {
      const rewardToChange = hre.ethers.parseUnits("2", DECIMALS);
      for (const manager of managers) {
        await tinyBankC.connect(manager).confirm();
      }
      await tinyBankC.connect(managers[0]).setRewardPerBlock(rewardToChange);
      await expect(
        tinyBankC.connect(managers[0]).setRewardPerBlock(rewardToChange)
      ).to.be.revertedWith("Not all confirmed yet");
    });
  });
});
