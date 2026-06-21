# Bayanihan Fund

Bayanihan Fund is a Stellar community emergency treasury. Residents contribute
tokens to a Soroban contract, the treasurer creates withdrawal requests, and
both the president and secretary must approve a request before funds can be
released.

The frontend includes an empty Demo sandbox for pitching and a Live Testnet mode
for real wallet-signed contract calls. Testnet assets have no real-world value.

## MVP Features

- Freighter-first wallet connection with Stellar Wallets Kit fallback
- Testnet XLM or another Stellar Asset Contract token
- Contributions with wallet-balance validation
- Treasurer-only withdrawal requests
- Independent president and secretary approvals
- Reserved fund accounting to prevent overcommitted requests
- Soroban transaction simulation, signing, submission, and status polling
- Contract event polling and automatic UI synchronization
- Typed contract errors and deployment-time role validation

## Project Structure

```text
bayanihan_fund/
|-- contracts/bayanihan-fund/
|   |-- src/lib.rs
|   `-- src/test.rs
|-- frontend/
|   |-- public/images/
|   `-- src/
|-- scripts/deploy-testnet.ps1
|-- Cargo.toml
|-- rust-toolchain.toml
`-- README.md
```

## Prerequisites

Install the following on Windows:

1. [Rust](https://rustup.rs)
2. Stellar CLI:

```powershell
cargo install --locked stellar-cli
stellar --version
```

3. Node.js and npm
4. Freighter configured for Stellar Testnet

The checked-in `rust-toolchain.toml` installs the required Rust target and
formatting components when Rust commands run in this repository.

## Prepare Testnet Accounts

Create and fund a CLI identity that will deploy the contract:

```powershell
stellar keys generate deployer --network testnet --fund
stellar keys address deployer
```

The contract requires three different `G...` account addresses:

- Treasurer
- President
- Secretary

These may be public addresses from separate Freighter Testnet accounts. To use
the approval workflow in the frontend, each officer account must be accessible
in Freighter so its owner can sign the corresponding action.

## One-Command Testnet Deployment

From the repository root, replace the sample role addresses and run:

```powershell
.\scripts\deploy-testnet.ps1 `
  -Treasurer "G_TREASURER_ADDRESS" `
  -President "G_PRESIDENT_ADDRESS" `
  -Secretary "G_SECRETARY_ADDRESS"
```

The script performs the complete deployment workflow:

1. Verifies Rust, Stellar CLI, role addresses, and the deployer identity.
2. Runs `cargo test --workspace`.
3. Builds optimized contract WASM.
4. Resolves the native Testnet XLM token contract.
5. Deploys the contract and invokes its constructor atomically.
6. Writes the returned contract ID to `frontend/.env`.
7. Prints the Stellar Expert contract explorer URL.

Use another Stellar Asset Contract by supplying its contract ID and symbol:

```powershell
.\scripts\deploy-testnet.ps1 `
  -Treasurer "G_TREASURER_ADDRESS" `
  -President "G_PRESIDENT_ADDRESS" `
  -Secretary "G_SECRETARY_ADDRESS" `
  -TokenContract "C_TOKEN_CONTRACT_ID" `
  -TokenSymbol "USDC"
```

Use `-SkipTests` only when tests were already run successfully in the same
revision.

## Manual Contract Commands

```powershell
cargo test --workspace
stellar contract build
stellar contract id asset --asset native --network testnet
```

The deployment artifact is created at:

```text
target/wasm32v1-none/release/bayanihan_fund.wasm
```

## Frontend

After deployment, the script creates `frontend/.env` in this format:

```env
VITE_CONTRACT_ID=C_DEPLOYED_CONTRACT_ID
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_TOKEN_SYMBOL=XLM
```

Install dependencies and start the app:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, select Live mode, connect Freighter, and confirm
that Freighter is still set to Testnet.

## Testnet Validation Flow

1. Connect a funded resident wallet and contribute a small XLM amount.
2. Connect the configured treasurer wallet and create a withdrawal request.
3. Connect the configured president wallet and approve the request.
4. Connect the configured secretary wallet and approve the request.
5. Execute the fully approved request.
6. Verify the transaction links, balances, request state, and recipient balance.

The contract reserves requested funds when a request is created. This prevents
multiple open requests from promising more than the available treasury balance.

## Production Note

This repository targets Stellar Testnet. A production launch requires a new
Mainnet deployment, a deliberate asset choice, operational key management,
independent security review, legal/compliance review, monitoring, and a tested
recovery process. Never reuse Testnet contract IDs or assumptions on Mainnet.
