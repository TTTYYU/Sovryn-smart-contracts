pragma solidity ^0.5.17;


interface IFeeSharingProxy {
	function withdrawFees(address _token) external;
	function withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) external;
}