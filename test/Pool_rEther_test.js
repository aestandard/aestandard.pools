const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("rEtherPool", function () {
  let rEtherPool, rEtherPoolContract, owner, wallet1, wallet2, wallet3;
  let tenMatic = ethers.utils.parseEther("10");
  let fiveMatic = ethers.utils.parseEther("5");
  let hundredMatic = ethers.utils.parseEther("100");
  let thousandAES = ethers.utils.parseEther("1000");
  let eightyMatic = ethers.utils.parseEther("80");
  let twentyMatic = ethers.utils.parseEther("20");
  let twentyFiveMatic = ethers.utils.parseEther("25");
  let fortyMatic = ethers.utils.parseEther("40");
  let fiftyUnits = ethers.utils.parseEther("50");

  beforeEach(async () => {
    // Deploy Contracts before we start tests
    rEtherPool = await ethers.getContractFactory("AESPool");
    rEtherPoolContract = await rEtherPool.deploy();
    aesToken = await ethers.getContractFactory("AES");
    aesTokenContract = await aesToken.deploy();
    [owner, wallet1, wallet2, wallet3] = await ethers.getSigners();
  });

  // Node Functions
  function getPercentage(num, percent) { return ((Number(percent) / 100) * Number(num)); }
  function getPercentageOfTwoNumbers(smallNum, bigNum){ return ((Number(smallNum) / Number(bigNum)) * 100); }

  async function sendUserRewards(stakerCount, totalBal, dPercentage, rBal){
    for (var i = 0; i < stakerCount; i++) {
      let address = await rEtherPoolContract.GetStakerById(i);
      let stakingBal = ethers.utils.formatUnits(await rEtherPoolContract.stakingBalance(address));
      // Send the user their reward
      let dAmount = getPercentage(rBal, dPercentage); // x RewardToken
      let userPercentage = getPercentageOfTwoNumbers(stakingBal, totalBal);
      let userRewardAmount = getPercentage(dAmount, userPercentage).toFixed(6);
      //console.log("Updating " + userRewardAmount + " AES to addr " + address);
      //console.log("dAmount: " + dAmount + " / userPercentage: " + userPercentage + " / userRewardAmount: " + userRewardAmount + " / dPercentage: " + dPercentage + " / rBal: " + rBal);
      // Send Reward
      await rEtherPoolContract.UpdateRewardBalance(address, ethers.utils.parseEther(userRewardAmount));
      await rEtherPoolContract.RemoveFromRewardTokenHoldingAmount(ethers.utils.parseEther(userRewardAmount));

    }
  }

  it("Should receive 10 MATIC from w1 and send to custodian", async function () {
    const stakeTX = await wallet1.sendTransaction({
      to: rEtherPoolContract.address,
      value: tenMatic
    });
    await stakeTX.wait();
    expect(Math.round(ethers.utils.formatUnits(await owner.getBalance()))).to.equal(10010);
  });

  it("Should receive 5 Staked MATIC from w2 and add w2 to stakers", async function () {
    let temporaryContract = rEtherPoolContract.connect(wallet2);
    await temporaryContract.Stake({ value: fiveMatic });
    expect(await rEtherPoolContract.isStaking(wallet2.address)).to.equal(true);
    expect(ethers.utils.formatUnits(await rEtherPoolContract.GetMATICBalance())).to.equal("5.0");
  });

  it("Should send 5 Staked MATIC to w2 and remove w2 from stakers", async function () {
    let temporaryContract = rEtherPoolContract.connect(wallet2);
    // Get originalBal
    let originalBal = ethers.utils.formatUnits(await wallet2.getBalance());
    //console.log("w2 Balance = " + Math.round(originalBal));
    // Stake and Unstake
    await temporaryContract.Stake({ value: hundredMatic });
    //console.log(Math.round(ethers.utils.formatUnits(await wallet2.getBalance())));
    await temporaryContract.Unstake();
    expect(await rEtherPoolContract.isStaking(wallet2.address)).to.equal(false);
    // Get updated Bal
    let updatedBal = ethers.utils.formatUnits(await wallet2.getBalance());
    //console.log("w2 Balance = " + Math.round(updatedBal));
    // Updated Bal = Old Bal - 5% Withdrawal Fee (OF STAKING AMOUNT 100 MATIC)
    let fee = 5; // 5 Matic Fee
    expect(Math.round(updatedBal)).to.equal(Math.round((originalBal - fee)));
  });

  it("Should update the correct amount of rewards for users", async function () {
    // Send 100 AES to Contract
    await aesTokenContract.transfer(rEtherPoolContract.address, hundredMatic); // 100 AES
    await rEtherPoolContract.UpdateRewardTokenHoldingAmount(hundredMatic);
    // w1 stake 80, w2 stake 20
    let walletOnePoolContract = rEtherPoolContract.connect(wallet1);
    await walletOnePoolContract.Stake({ value: eightyMatic }); // 80 MATIC
    let walletTwoPoolContract = rEtherPoolContract.connect(wallet2);
    await walletTwoPoolContract.Stake({ value: twentyMatic }); // 20
    // Should Recieve Matic & Correct DP (10% of 100 = 10)
    expect(ethers.utils.formatUnits(await rEtherPoolContract.GetMATICBalance())).to.equal("100.0");
    await rEtherPoolContract.ChangeDistributionPercentage("100");
    expect(ethers.utils.formatUnits(await rEtherPoolContract.DistributionPercentage(), 0)).to.equal("100");
    // Update Reward Balances
    let TotalStakingBalance = ethers.utils.formatUnits(await rEtherPoolContract.TotalStakingBalance(), 0);
    let StakerCount = ethers.utils.formatUnits(await rEtherPoolContract.GetStakersLength(), 0);
    let DistributionPercentage = ethers.utils.formatUnits(await rEtherPoolContract.DistributionPercentage(), 0) / 10;
    let RewardBalance = ethers.utils.formatUnits(await rEtherPoolContract.aesTokenHoldingAmount());
    await sendUserRewards(StakerCount, TotalStakingBalance, DistributionPercentage, RewardBalance);
    expect(ethers.utils.formatUnits(await rEtherPoolContract.rewardBalance(wallet1.address))).to.equal("8.0");
    expect(ethers.utils.formatUnits(await rEtherPoolContract.rewardBalance(wallet2.address))).to.equal("2.0");
  });

  it("Should send 100 AES reward for w1", async function () {
    // Give Contract 1000 AES and Update Token Bal
    await aesTokenContract.transfer(rEtherPoolContract.address, thousandAES); // 100 AES*
    //console.log(Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(rEtherPoolContract.address))));
    await rEtherPoolContract.setAESAddress(aesTokenContract.address);
    await rEtherPoolContract.UpdateRewardTokenHoldingAmount(thousandAES);
    await rEtherPoolContract.ChangeDistributionPercentage("100");
    expect(ethers.utils.formatUnits(await rEtherPoolContract.DistributionPercentage(), 0)).to.equal("100");
    // Wallet 1 has the whole pool
    let walletOnePoolContract = rEtherPoolContract.connect(wallet1);
    await walletOnePoolContract.Stake({ value: eightyMatic }); // 80 MATIC
    // Node Server calls for Reward Update.
    let TotalStakingBalance = ethers.utils.formatUnits(await rEtherPoolContract.TotalStakingBalance(), 0);
    let StakerCount = ethers.utils.formatUnits(await rEtherPoolContract.GetStakersLength(), 0);
    let DistributionPercentage = ethers.utils.formatUnits(await rEtherPoolContract.DistributionPercentage(), 0) / 10;
    let RewardBalance = ethers.utils.formatUnits(await rEtherPoolContract.aesTokenHoldingAmount());
    await sendUserRewards(StakerCount, TotalStakingBalance, DistributionPercentage, RewardBalance);
    let aesBalOriginal = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(wallet1.address)));
    // We don't have any AES tokens
    expect(aesBalOriginal).to.equal(0);
    // We collect the rewards.
    //console.log(Math.round(ethers.utils.formatUnits(await rEtherPoolContract.rewardBalance(wallet1.address))));
    walletOnePoolContract.CollectRewards();
    //console.log(Math.round(ethers.utils.formatUnits(await rEtherPoolContract.rewardBalance(wallet1.address))));
    let aesBalUpdated = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(wallet1.address)));
    expect(aesBalUpdated).to.equal(100); // 10% Tax
  });

  it("Should send fees (5 MATIC) to custodian", async function () {
    let ogBal = Math.round(ethers.utils.formatUnits(await owner.getBalance()));
    let walletOnePoolContract = rEtherPoolContract.connect(wallet1);
    await walletOnePoolContract.Stake({ value: hundredMatic });
    //console.log(ogBal);
    await walletOnePoolContract.Unstake();
    await rEtherPoolContract.CollectFees();
    let newBal = Math.round(ethers.utils.formatUnits(await owner.getBalance()));
    //console.log(newBal)
    expect(newBal).to.equal((ogBal + 5));
  });

  it("Should withdraw 1000 AES to custodian", async function () {
    let ogBal = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(owner.getAddress())));
    await rEtherPoolContract.setAESAddress(aesTokenContract.address);
    //console.log(ogBal);
    await aesTokenContract.transfer(rEtherPoolContract.address, thousandAES);
    let balAfterSent = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(owner.getAddress())));
    expect(balAfterSent).to.equal(9000);
    await rEtherPoolContract.WithdrawAES();
    let balAfterWithdraw = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(owner.getAddress())));
    expect(balAfterWithdraw).to.equal(10000);
  });

  it("Should send 1.25 AES reward for w1", async function () {
    // Give Contract 1250 AES and Update Token Bal
    await aesTokenContract.transfer(rEtherPoolContract.address, ethers.utils.parseEther("1250")); //
    //console.log(Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(rEtherPoolContract.address))));
    await rEtherPoolContract.setAESAddress(aesTokenContract.address);
    await rEtherPoolContract.UpdateRewardTokenHoldingAmount(ethers.utils.parseEther("1250"));
    expect(ethers.utils.formatUnits(await rEtherPoolContract.DistributionPercentage(), 0)).to.equal("1");
    // Wallet 1 has the whole pool
    let walletOnePoolContract = rEtherPoolContract.connect(wallet1);
    await walletOnePoolContract.Stake({ value: eightyMatic }); // 80 MATIC
    // Node Server calls for Reward Update.
    let TotalStakingBalance = ethers.utils.formatUnits(await rEtherPoolContract.TotalStakingBalance(), 0);
    let StakerCount = ethers.utils.formatUnits(await rEtherPoolContract.GetStakersLength(), 0);
    let DistributionPercentage = ethers.utils.formatUnits(await rEtherPoolContract.DistributionPercentage(), 0) / 10;
    let RewardBalance = ethers.utils.formatUnits(await rEtherPoolContract.aesTokenHoldingAmount());
    await sendUserRewards(StakerCount, TotalStakingBalance, DistributionPercentage, RewardBalance);
    let aesBalOriginal = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(wallet1.address)));
    // We don't have any AES tokens
    expect(aesBalOriginal).to.equal(0);
    // We collect the rewards.
    //console.log(Math.round(ethers.utils.formatUnits(await rEtherPoolContract.rewardBalance(wallet1.address))));
    walletOnePoolContract.CollectRewards();
    //console.log(Math.round(ethers.utils.formatUnits(await rEtherPoolContract.rewardBalance(wallet1.address))));
    let aesBalUpdated = ethers.utils.formatUnits(await aesTokenContract.balanceOf(wallet1.address));
    expect(aesBalUpdated).to.equal("1.25");
  });
});
