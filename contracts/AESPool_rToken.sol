pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/*
         _                   _           _
        / /\                /\ \        / /\
       / /  \              /  \ \      / /  \
      / / /\ \            / /\ \ \    / / /\ \__
     / / /\ \ \          / / /\ \_\  / / /\ \___\
    / / /  \ \ \        / /_/_ \/_/  \ \ \ \/___/
   / / /___/ /\ \      / /____/\      \ \ \
  / / /_____/ /\ \    / /\____\/  _    \ \ \
 / /_________/\ \ \  / / /______ /_/\__/ / /
/ / /_       __\ \_\/ / /_______\\ \/___/ /
\_\___\     /____/_/\/__________/ \_____\/

Advance Encryption Standard Finance.

Website:aestandard.finance
Email:team@aestandard.finance
Bug Bounty:team@aestandard.finance

License: MIT

AES Cryptoasset Staking Pool, Recieve Token. (Version 1)
Network: Polygon


*/

contract AESPoolrToken is ReentrancyGuard {

    // Name of contract
    string public name = "AES Staking Pool (receive Token) V1";

    // Define the variables we'll be using on the contract
    address public stakingToken = 0x5aC3ceEe2C3E6790cADD6707Deb2E87EA83b0631; // stake AES 
    address public aesToken = 0x5aC3ceEe2C3E6790cADD6707Deb2E87EA83b0631; // earn AES
    address public custodian;

    address[] public stakers;
    mapping(address => uint) public stakingBalance;
    mapping(address => uint) public rewardBalance; // aesBalance
    mapping(address => bool) public isStaking;

    uint public aesTokenHoldingAmount;
    uint public DistributionPercentage = 1; // 1 = 0.1%
    uint public withdrawalFee = 500;
    uint public custodianFees;

    constructor() ReentrancyGuard() public {
      custodian = msg.sender;
    }

    modifier CustodianOnly() {
      require(msg.sender == custodian);
      _;
    }

    // Some Internal helper functions
    function FindStakerIndex(address user) internal view returns (uint index) {
      for (uint x = 0; x < stakers.length; x++){
        if(stakers[x] == user){
          return x;
        }
      }
    }

    function RemoveFromStakers(uint index) internal {
      require(index <= stakers.length);
      stakers[index] = stakers[stakers.length-1];
      stakers.pop();
    }

    function IsUserStaking(address user) public view returns (bool staking){
      return isStaking[user];
    }

    function FindPercentage(uint number, uint percent) public pure returns (uint result){
        return ((number * percent) / 10000);
    }

    function TotalStakingBalance() public view returns (uint result) {
      uint stakingTotal = 0;
      for (uint x = 0; x < stakers.length; x++){
        stakingTotal = stakingTotal + stakingBalance[stakers[x]];
      }
      return (stakingTotal / (10 ** 18));
    }

    // Contract functions begin

    function StakeTokens(uint amount) nonReentrant() public payable {
      // user needs to first approve this contract to spend (amount of) tokens
      require(amount > 0, "An amount must be passed through as an argument");
      bool recieved = IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
      if(recieved){
        // Get the sender
        address user = msg.sender;
        // Update the staking balance array
        stakingBalance[user] = stakingBalance[user] + amount;
        // Check if the sender is not staking
        if(!isStaking[user]){
          // Add them to stakers
          stakers.push(user);
          isStaking[user] = true;
        }
      }
    }

    function Unstake() nonReentrant() public {
      // Get the MATIC sender
      address user = msg.sender;
      // get the users staking balance
      uint bal = stakingBalance[user];
      // reqire the amount staked needs to be greater then 0
      require(bal > 0, "Your staking balance cannot be zero");
      // reset their staking balance
      stakingBalance[user] = 0;
      // Remove them from stakers
      uint userPosition = FindStakerIndex(user);
      RemoveFromStakers(userPosition);
      isStaking[user] = false;
      // Send the staker their tokens (5% Withdrawal Fee)
      uint fee = FindPercentage(bal, withdrawalFee);
      uint rAmount = bal - fee; // return Amount
      IERC20(stakingToken).approve(address(this), 0);
      IERC20(stakingToken).approve(address(this), rAmount);
      bool sent = IERC20(stakingToken).transferFrom(address(this), user, rAmount);
      if(!sent){
        stakingBalance[user] = bal;
      }else{
        // Send the fee (if there is any)
        custodianFees = custodianFees + fee;
      }
    }

    function CollectRewards() nonReentrant() public {
      address user = msg.sender;
      uint rBal = rewardBalance[user];
      require(rBal > 0, "Your reward balance cannot be zero");
      rewardBalance[user] = 0;
      // Send the reward Token (AES)
      IERC20(aesToken).approve(address(this), 0);
      IERC20(aesToken).approve(address(this), rBal);
      bool sent = IERC20(aesToken).transferFrom(address(this), user, rBal);
      if(!sent){ rewardBalance[user] = rBal; }
    }

    function CollectFees() nonReentrant() public CustodianOnly {
      IERC20(stakingToken).approve(address(this), 0);
      IERC20(stakingToken).approve(address(this), custodianFees);
      bool sent = IERC20(stakingToken).transferFrom(address(this), custodian, custodianFees);
      if(sent){custodianFees = 0;}
    }

    // Should be called after initial AES is sent or when Tokens are recieved.
    function UpdateRewardTokenHoldingAmount(uint amount) public CustodianOnly {
      aesTokenHoldingAmount = aesTokenHoldingAmount + amount;
    }

    function RemoveFromRewardTokenHoldingAmount(uint amount) public CustodianOnly {
      aesTokenHoldingAmount = aesTokenHoldingAmount - amount;
    }

    // Don't send matic directly to the contract
    receive() nonReentrant() external payable {
      (bool sent, bytes memory data) = custodian.call{value: msg.value}("");
      if(!sent){ custodianFees = custodianFees + msg.value; }
    }

    function UpdateRewardBalance(address user, uint amount) public CustodianOnly {
      require(stakingBalance[user] > 0, "Cannot give rewards to a user with nil staking balance");
      rewardBalance[user] = rewardBalance[user] + amount;
    }

    function GetStakersLength() public CustodianOnly view returns (uint count) {
      return stakers.length;
    }

    function GetStakerById(uint id) public view CustodianOnly returns (address user) {
      return stakers[id];
    }

    function ChangeDistributionPercentage(uint percent) public CustodianOnly {
      require(1000 >= percent, "Distribution Overflow");
      DistributionPercentage = percent;
    }

    function ChangeWithdrawalFee(uint percent) public CustodianOnly {
      require(1000 >= percent, "Withdrawal Overflow");
      withdrawalFee = percent;
    }

    function SetStakingTokenAddress(address addr) public CustodianOnly {
      stakingToken = addr;
    }

    // Only used in testing
    function setAESAddress(address addr) public CustodianOnly {
      aesToken = addr;
    }

    function WithdrawAES() nonReentrant() public CustodianOnly {
      uint aesBal = IERC20(aesToken).balanceOf(address(this));
      require(aesBal > 0, "The contracts AES balance cannot be zero");
      IERC20(aesToken).approve(address(this), 0);
      IERC20(aesToken).approve(address(this), aesBal);
      bool sent = IERC20(aesToken).transferFrom(address(this), custodian, aesBal);
      if(sent){
        aesTokenHoldingAmount = 0;
        for (uint x = 0; x < stakers.length; x++){
          rewardBalance[stakers[x]] = 0;
        }
      }
    }

    function GetMATICBalance() public view returns (uint maticBal) {
      return address(this).balance;
    }
}
