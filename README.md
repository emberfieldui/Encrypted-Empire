# Encrypted Empire

Encrypted Empire is a homomorphically encrypted strategy mini-game where every player explores a 10 × 10 on-chain battlefield without revealing their exact location. All coordinates and movement commands are encrypted with Zama's FHEVM, allowing the smart contract to update state privately while keeping gameplay verifiable on-chain.

## Why Encrypted Empire Matters

- **Private yet verifiable gameplay:** Player positions remain hidden from the public ledger while moves are still validated by smart contracts.
- **Composable encrypted primitives:** The project demonstrates how to combine Zama FHE tooling with standard EVM infrastructure for privacy-preserving game logic.
- **Seamless web3 experience:** Wallet-based authentication, encrypted inputs, and real-time board visualization offer a polished user journey without leaking sensitive data.

## Problems We Solve

- **On-chain privacy:** Traditional blockchain games expose every action. We use fully homomorphic encryption so movement commands and coordinates stay private.
- **Trusted randomness for spawning:** Players receive randomized starting coordinates that only they can decrypt, eliminating the need to trust a centralized server.
- **Encrypted state management:** The contract updates encrypted coordinates directly, showcasing how to mutate sensitive game state without decrypting it on-chain.

## Core Features

- 10 × 10 grid with boundary enforcement and encrypted coordinates.
- Randomized encrypted spawn positions per wallet.
- Encrypted movement (up, down, left, right) with collision-free updates.
- Player roster tracking for analytics while preserving individual positions.
- React-based dashboard to join, move, and decrypt personal coordinates in real time.

## Technology Stack

- **Smart Contracts:** Solidity 0.8.27 with Hardhat, hardhat-deploy, and TypeChain.
- **Privacy Layer:** Zama FHEVM (`@fhevm/solidity`, Zama Sepolia configuration) delivering encrypted integers and permission controls.
- **Frontend:** React 18 + Vite, RainbowKit, Wagmi, Viem for reads, and Ethers v6 for writes.
- **Tooling & Deployment:** Hardhat scripts, tasks, gas reporter, Solidity coverage, and a Sepolia deployment flow secured by environment-driven private keys.

## Repository Structure

```
contracts/             # EncryptedEmpireGame smart contract
deploy/                # Hardhat-deploy scripts for private-key deployments
deployments/           # Persisted deployment artifacts (local and Sepolia)
game/                  # React + Vite front-end that connects to the contract
tasks/                 # Custom Hardhat tasks for game utilities
test/                  # Contract tests validating encrypted logic
```

## Getting Started

### Prerequisites

- Node.js v20+
- npm v9+
- Access to a Sepolia-funded private key and an Infura API key

### Environment Variables

Create a `.env` file in the project root:

```
PRIVATE_KEY=0x...
INFURA_API_KEY=...
ETHERSCAN_API_KEY=...
MNEMONIC="test test test test test test test test test test test junk" # optional for local use
```

> The deployment scripts automatically load environment variables through `dotenv`; no Hardhat vars store is required.

### Install Dependencies

```bash
npm install
cd game
npm install
```

### Compile & Test Contracts

```bash
npm run compile
npm run test
```

### Local Development Node

```bash
npx hardhat node
npx hardhat deploy --network hardhat
```

Set the generated contract address inside `game/src/config/contracts.ts` to interact with the local deployment.

### Sepolia Deployment

```bash
npx hardhat deploy --network sepolia
```

Deployment artifacts and ABIs appear under `deployments/sepolia`. Copy the ABI into the front-end config as required.

### Frontend Development

```bash
cd game
npm run dev
```

The Vite dev server connects to Sepolia; configure the contract address before launching.

## Architecture Overview

- **Contract Logic:** `EncryptedEmpireGame` stores encrypted coordinates per player, validates moves, and emits events for front-end updates. Movement proofs ensure inputs come from the rightful wallet.
- **Encryption Flow:** The front end leverages Zama's SDK to encrypt spawn coordinates and movement directions client-side. Proofs accompany every transaction so the contract can accept the ciphertext.
- **State Sync:** Viem provides gas-efficient reads for grid size, join status, and encrypted positions, while Ethers handles encrypted writes that require signing.
- **UI/UX:** Players connect via RainbowKit, join the game, decrypt their coordinates locally, and issue encrypted movement commands through intuitive controls and status messaging.

## Advantages

- **End-to-end privacy:** No plaintext coordinates ever touch the blockchain, preserving strategic secrecy.
- **Transparent validation:** Every state change is on-chain, auditable, and replayable without revealing private inputs.
- **Modular design:** Contract, tasks, and front end are cleanly separated, enabling independent iteration or integration with additional games.
- **Production-ready tooling:** Uses widely adopted frameworks (Hardhat, Vite, RainbowKit) to accelerate onboarding for both Solidity and React developers.

## Future Roadmap

- **Team-based mechanics:** Enable encrypted alliances, shared vision, and cooperative objectives.
- **Encrypted combat:** Expand actions beyond movement, such as hidden attacks or resource gathering.
- **Cross-chain expansion:** Explore FHE-compatible L2 deployments for lower gas costs and faster confirmations.
- **Analytics portal:** Provide aggregated insights (without deanonymizing players) for game masters and spectators.
- **Mobile client:** Package the React experience for mobile wallets supporting FHE transaction flows.

## Contributing

Contributions are welcome. Please open an issue describing your proposal before submitting a pull request so we can coordinate on encrypted data handling expectations.

## License

This project is distributed under the BSD-3-Clause-Clear License. Refer to `LICENSE` for the full terms.
