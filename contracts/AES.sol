pragma solidity ^0.8.0;

/*

A Mimic of the AES Token.

*/

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AES is ERC20 {
    constructor() ERC20("AES", "aestandard.finance") {
        _mint(msg.sender, 10000000000000000000000);
    }

    function decimals() public view virtual override returns (uint8) {
      return 9;
    }
}
