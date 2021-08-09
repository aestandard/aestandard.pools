const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("rTokenPool", function () {
  let rTokenPool, rTokenPoolContract, owner, wallet1, wallet2, wallet3;
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
    rTokenPool = await ethers.getContractFactory("AESPoolrToken");
    rTokenPoolContract = await rTokenPool.deploy();
    aesToken = await ethers.getContractFactory("AES");
    aesTokenContract = await aesToken.deploy();
    usdcToken = await ethers.getContractFactory("USDC");
    usdcTokenContract = await usdcToken.deploy();
    [owner, wallet1, wallet2, wallet3] = await ethers.getSigners();
  });

  // Node Functions
  function getPercentage(num, percent) { return ((Number(percent) / 100) * Number(num)); }
  function getPercentageOfTwoNumbers(smallNum, bigNum){ return ((Number(smallNum) / Number(bigNum)) * 100); }

  async function sendUserRewards(stakerCount, totalBal, dPercentage, rBal){
    for (var i = 0; i < stakerCount; i++) {
      let address = await rTokenPoolContract.GetStakerById(i);
      let stakingBal = ethers.utils.formatUnits(await rTokenPoolContract.stakingBalance(address));
      // Send the user their reward
      let dAmount = getPercentage(rBal, dPercentage); // x RewardToken
      let userPercentage = getPercentageOfTwoNumbers(stakingBal, totalBal);
      let userRewardAmount = getPercentage(dAmount, userPercentage).toFixed(6);
      //console.log("Updating " + userRewardAmount + " AES to addr " + address);
      //console.log("dAmount: " + dAmount + " / userPercentage: " + userPercentage + " / userRewardAmount: " + userRewardAmount + " / dPercentage: " + dPercentage + " / rBal: " + rBal);
      // Send Reward
      await rTokenPoolContract.UpdateRewardBalance(address, ethers.utils.parseEther(userRewardAmount));
      await rTokenPoolContract.RemoveFromRewardTokenHoldingAmount(ethers.utils.parseEther(userRewardAmount));

    }
  }

  it("Should receive 10 MATIC from w1 and send to custodian", async function () {
    let oldBal = Math.round(ethers.utils.formatUnits(await owner.getBalance()));
    //console.log(oldBal);
    const stakeTX = await wallet1.sendTransaction({
      to: rTokenPoolContract.address,
      value: tenMatic
    });
    await stakeTX.wait();
    let newBal = Math.round(ethers.utils.formatUnits(await owner.getBalance()));
    //console.log(newBal);
    expect(newBal).to.equal((oldBal + 10));
  });

  it("Should receive 5 Staked USDC from w2 and add w2 to stakers", async function () {
    let temporaryContract = rTokenPoolContract.connect(wallet2);
    let temporaryContractUSDC = usdcTokenContract.connect(wallet2);
    //console.log(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(wallet2.getAddress()), 0));
    await temporaryContractUSDC.Mint();
    //console.log(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(wallet2.getAddress()), 0));
    await rTokenPoolContract.SetStakingTokenAddress(usdcTokenContract.address);
    // First allow then transfer
    //console.log(ethers.utils.formatUnits(fiveMatic));
    await temporaryContractUSDC.approve(rTokenPoolContract.address, fiveMatic);
    await temporaryContract.StakeTokens(fiveMatic);
    expect(await rTokenPoolContract.isStaking(wallet2.address)).to.equal(true);
    expect(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(rTokenPoolContract.address))).to.equal("5.0");
    //console.log(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(wallet2.getAddress()), 0));
    await temporaryContract.Unstake();
    //console.log(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(wallet2.getAddress()), 0));
  });


  it("Should send 100 Staked MATIC to w2 and remove w2 from stakers", async function () {
    let temporaryContract = rTokenPoolContract.connect(wallet2);
    let temporaryContractUSDC = usdcTokenContract.connect(wallet2);
    await temporaryContractUSDC.Mint();
    await rTokenPoolContract.SetStakingTokenAddress(usdcTokenContract.address);
    // Get originalBal
    let originalBal = ethers.utils.formatUnits(await usdcTokenContract.balanceOf(wallet2.getAddress()));
    //console.log("w2 Balance = " + Math.round(originalBal));
    // Stake and Unstake
    await temporaryContractUSDC.approve(rTokenPoolContract.address, hundredMatic);
    await temporaryContract.StakeTokens(hundredMatic);
    //console.log(Math.round(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(wallet2.getAddress())));
    await temporaryContract.Unstake();
    expect(await rTokenPoolContract.isStaking(wallet2.address)).to.equal(false);
    // Get updated Bal
    let updatedBal = ethers.utils.formatUnits(await usdcTokenContract.balanceOf(wallet2.getAddress()));
    //console.log("w2 Balance = " + Math.round(updatedBal));
    // Updated Bal = Old Bal - 5% Withdrawal Fee (OF STAKING AMOUNT 100 MATIC)
    let fee = 5; // 5 Matic Fee
    expect(Math.round(updatedBal)).to.equal(Math.round((originalBal - fee)));
  });

  it("Should update the correct amount of rewards for users", async function () {
    // Send 100 AES to Contract
    await aesTokenContract.transfer(rTokenPoolContract.address, hundredMatic); // 100 AES
    await rTokenPoolContract.UpdateRewardTokenHoldingAmount(hundredMatic);
    await rTokenPoolContract.SetStakingTokenAddress(usdcTokenContract.address);
    // w1 stake 80, w2 stake 20
    let walletOnePoolContract = rTokenPoolContract.connect(wallet1);
    let walletOneUSDCContract = usdcTokenContract.connect(wallet1);
    await walletOneUSDCContract.Mint();
    await walletOneUSDCContract.approve(rTokenPoolContract.address, eightyMatic);
    await walletOnePoolContract.StakeTokens(eightyMatic); // 80 USDC
    let walletTwoPoolContract = rTokenPoolContract.connect(wallet2);
    let walletTwoUSDCContract = usdcTokenContract.connect(wallet2);
    await walletTwoUSDCContract.Mint();
    await walletTwoUSDCContract.approve(rTokenPoolContract.address, twentyMatic);
    await walletTwoPoolContract.StakeTokens(twentyMatic); // 20 USDC
    // Should Recieve Matic & Correct DP (10% of 100 = 10)
    expect(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(await rTokenPoolContract.address))).to.equal("100.0");
    await rTokenPoolContract.ChangeDistributionPercentage("100");
    expect(ethers.utils.formatUnits(await rTokenPoolContract.DistributionPercentage(), 0)).to.equal("100");
    // Update Reward Balances
    let TotalStakingBalance = ethers.utils.formatUnits(await rTokenPoolContract.TotalStakingBalance(), 0);
    let StakerCount = ethers.utils.formatUnits(await rTokenPoolContract.GetStakersLength(), 0);
    let DistributionPercentage = ethers.utils.formatUnits(await rTokenPoolContract.DistributionPercentage(), 0) / 10;
    let RewardBalance = ethers.utils.formatUnits(await rTokenPoolContract.aesTokenHoldingAmount());
    await sendUserRewards(StakerCount, TotalStakingBalance, DistributionPercentage, RewardBalance);
    expect(ethers.utils.formatUnits(await rTokenPoolContract.rewardBalance(wallet1.address))).to.equal("8.0");
    expect(ethers.utils.formatUnits(await rTokenPoolContract.rewardBalance(wallet2.address))).to.equal("2.0");
  });

  it("Should send 100 AES reward for w1", async function () {
    // Give Contract 1000 AES and Update Token Bal
    await aesTokenContract.transfer(rTokenPoolContract.address, thousandAES); // 100 AES*
    //console.log(Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(rTokenPoolContract.address))));
    await rTokenPoolContract.setAESAddress(aesTokenContract.address);
    await rTokenPoolContract.UpdateRewardTokenHoldingAmount(thousandAES);
    await rTokenPoolContract.ChangeDistributionPercentage("100");
    await rTokenPoolContract.SetStakingTokenAddress(usdcTokenContract.address);
    expect(ethers.utils.formatUnits(await rTokenPoolContract.DistributionPercentage(), 0)).to.equal("100");
    // Wallet 1 has the whole pool
    let walletOnePoolContract = rTokenPoolContract.connect(wallet1);
    let walletOneUSDCContract = usdcTokenContract.connect(wallet1);
    await walletOneUSDCContract.Mint();
    await walletOneUSDCContract.approve(rTokenPoolContract.address, eightyMatic);
    await walletOnePoolContract.StakeTokens(eightyMatic); // 80 USDC
    // Node Server calls for Reward Update.
    let TotalStakingBalance = ethers.utils.formatUnits(await rTokenPoolContract.TotalStakingBalance(), 0);
    let StakerCount = ethers.utils.formatUnits(await rTokenPoolContract.GetStakersLength(), 0);
    let DistributionPercentage = ethers.utils.formatUnits(await rTokenPoolContract.DistributionPercentage(), 0) / 10;
    let RewardBalance = ethers.utils.formatUnits(await rTokenPoolContract.aesTokenHoldingAmount());
    await sendUserRewards(StakerCount, TotalStakingBalance, DistributionPercentage, RewardBalance);
    let aesBalOriginal = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(wallet1.address)));
    // We don't have any AES tokens
    expect(aesBalOriginal).to.equal(0);
    // We collect the rewards.
    //console.log(Math.round(ethers.utils.formatUnits(await rTokenPoolContract.rewardBalance(wallet1.address))));
    walletOnePoolContract.CollectRewards();
    //console.log(Math.round(ethers.utils.formatUnits(await rTokenPoolContract.rewardBalance(wallet1.address))));
    let aesBalUpdated = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(wallet1.address)));
    expect(aesBalUpdated).to.equal(100); // 10% Tax
  });

  it("Should send fees (5 USDC) to custodian", async function () {
    let ogBal = Math.round(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(owner.address)));
    await rTokenPoolContract.SetStakingTokenAddress(usdcTokenContract.address);
    let walletOnePoolContract = rTokenPoolContract.connect(wallet1);
    let walletOneUSDCContract = usdcTokenContract.connect(wallet1);
    await walletOneUSDCContract.Mint();
    await walletOneUSDCContract.approve(rTokenPoolContract.address, eightyMatic);
    await walletOnePoolContract.StakeTokens(eightyMatic); // 80 USDC
    //console.log(ogBal);
    await walletOnePoolContract.Unstake();
    await rTokenPoolContract.CollectFees();
    let newBal = Math.round(ethers.utils.formatUnits(await usdcTokenContract.balanceOf(owner.address)));
    //console.log(newBal)
    expect(newBal).to.equal((ogBal + 4)); // 4/5 (due to rounding on the solidity side)
  });

  it("Should withdraw 1000 AES to custodian", async function () {
    let ogBal = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(owner.getAddress())));
    await rTokenPoolContract.setAESAddress(aesTokenContract.address);
    //console.log(ogBal);
    await aesTokenContract.transfer(rTokenPoolContract.address, thousandAES);
    let balAfterSent = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(owner.getAddress())));
    expect(balAfterSent).to.equal(9000);
    await rTokenPoolContract.WithdrawAES();
    let balAfterWithdraw = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(owner.getAddress())));
    expect(balAfterWithdraw).to.equal(10000);
  });

  it("Should send 1.25 AES reward for w1", async function () {
    // Give Contract 1250 AES and Update Token Bal
    await aesTokenContract.transfer(rTokenPoolContract.address, ethers.utils.parseEther("1250")); //
    //console.log(Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(rTokenPoolContract.address))));
    await rTokenPoolContract.setAESAddress(aesTokenContract.address);
    await rTokenPoolContract.UpdateRewardTokenHoldingAmount(ethers.utils.parseEther("1250"));
    expect(ethers.utils.formatUnits(await rTokenPoolContract.DistributionPercentage(), 0)).to.equal("1");
    // Wallet 1 has the whole pool
    await rTokenPoolContract.SetStakingTokenAddress(usdcTokenContract.address);
    let walletOnePoolContract = rTokenPoolContract.connect(wallet1);
    let walletOneUSDCContract = usdcTokenContract.connect(wallet1);
    await walletOneUSDCContract.Mint();
    await walletOneUSDCContract.approve(rTokenPoolContract.address, eightyMatic);
    await walletOnePoolContract.StakeTokens(eightyMatic); // 80 USDC
    // Node Server calls for Reward Update.
    let TotalStakingBalance = ethers.utils.formatUnits(await rTokenPoolContract.TotalStakingBalance(), 0);
    let StakerCount = ethers.utils.formatUnits(await rTokenPoolContract.GetStakersLength(), 0);
    let DistributionPercentage = ethers.utils.formatUnits(await rTokenPoolContract.DistributionPercentage(), 0) / 10;
    let RewardBalance = ethers.utils.formatUnits(await rTokenPoolContract.aesTokenHoldingAmount());
    await sendUserRewards(StakerCount, TotalStakingBalance, DistributionPercentage, RewardBalance);
    let aesBalOriginal = Math.round(ethers.utils.formatUnits(await aesTokenContract.balanceOf(wallet1.address)));
    // We don't have any AES tokens
    expect(aesBalOriginal).to.equal(0);
    // We collect the rewards.
    //console.log(Math.round(ethers.utils.formatUnits(await rTokenPoolContract.rewardBalance(wallet1.address))));
    walletOnePoolContract.CollectRewards();
    //console.log(Math.round(ethers.utils.formatUnits(await rTokenPoolContract.rewardBalance(wallet1.address))));
    let aesBalUpdated = ethers.utils.formatUnits(await aesTokenContract.balanceOf(wallet1.address));
    expect(aesBalUpdated).to.equal("1.25");
  });
});
