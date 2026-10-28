// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

abstract contract MultiManagedAccess {
    address[] public managers;
    mapping(address => bool) public isManager;
    mapping(address => bool) public confirmed;

    constructor(address[] memory _managers) {
        require(_managers.length >= 3, "At least 3 managers required");
        for (uint256 i = 0; i < _managers.length; i++) {
            require(!isManager[_managers[i]], "Duplicate manager");
            managers.push(_managers[i]);
            isManager[_managers[i]] = true;
        }
    }

    modifier onlyAllConfirmed() {
        require(isManager[msg.sender], "You are not a manager");
        require(allConfirmed(), "Not all confirmed yet");
        reset();
        _;
    }

    function confirm() external {
        require(isManager[msg.sender], "You are not a manager");
        confirmed[msg.sender] = true;
    }

    function allConfirmed() internal view returns (bool) {
        for (uint256 i = 0; i < managers.length; i++) {
            if (!confirmed[managers[i]]) {
                return false;
            }
        }
        return true;
    }

    function reset() internal {
        for (uint256 i = 0; i < managers.length; i++) {
            confirmed[managers[i]] = false;
        }
    }
}
