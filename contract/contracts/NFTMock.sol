// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// import "@soliditylabs/erc721-permit/contracts/ERC721Permit.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

import "./lib/ERC721PermitUpgradable.sol";

contract NFTMock is
    Initializable,
    ERC721PermitUpgradable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    using StringsUpgradeable for uint256;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    string private baseTokenURI;
    string private tokenURISuffix;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721PermitUpgradable_init("NFTMock", "NFTMock");
        __AccessControl_init();

        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    uint256 private _lastTokenId;

    function mint() public {
        _mint(msg.sender, ++_lastTokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );
        return
            string(
                abi.encodePacked(
                    baseTokenURI,
                    tokenId.toString(),
                    tokenURISuffix
                )
            );
    }

    function setBaseTokenURI(
        string calldata newBaseTokenURI
    ) external onlyRole(ADMIN_ROLE) {
        baseTokenURI = newBaseTokenURI;
    }

    function setTokenURISuffix(
        string calldata newTokenURISuffix
    ) external onlyRole(ADMIN_ROLE) {
        tokenURISuffix = newTokenURISuffix;
    }

    // function permit(
    //     address spender,
    //     uint256 tokenId,
    //     uint256 deadline,
    //     bytes memory signature
    // ) external override onlyRole(ADMIN_ROLE) {
    //     _permit(spender, tokenId, deadline, signature);
    // }

    // テスト用
    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        bytes memory signature
    ) external virtual override {
        _permit(spender, tokenId, deadline, signature);
    }

    function safeTransferFromWithPermit(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data,
        uint256 deadline,
        bytes memory signature
    ) external onlyRole(ADMIN_ROLE) {
        _permit(msg.sender, tokenId, deadline, signature);
        safeTransferFrom(from, to, tokenId, _data);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721PermitUpgradable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
