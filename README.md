# Bayanihan Fund

## Project Description

Bayanihan Fund is a transparent community emergency fund built on Stellar and Soroban. Residents contribute USDC to a shared treasury, while withdrawals require approval from multiple officers before funds are released. This ensures accountability, prevents misuse, and enables communities to respond quickly during disasters and medical emergencies.

---

## Project Vision

Bayanihan Fund aims to become a trusted treasury system for homeowners associations, barangays, cooperatives, churches, NGOs, and disaster response organizations.

By leveraging Stellar and Soroban smart contracts, communities can manage funds transparently and respond faster during emergencies.

---

## Key Features

* Community fund contributions
* Withdrawal request system
* Multi-officer approval mechanism
* Transparent treasury management
* USDC transfers on Stellar
* On-chain transaction records
* Dashboard for monitoring requests and balances

---

## Problem

Ramon, the president of a homeowners association in Parañaque City, Philippines, currently manages emergency contributions through cash and spreadsheets. During floods and medical emergencies, members often question where the money goes, resulting in mistrust and delayed responses.

---

## Solution

Residents contribute USDC through a web application. Soroban smart contracts transparently record contributions and require approvals from multiple officers before emergency funds are released.

---

## Stellar Features Used

* Soroban Smart Contracts
* USDC Transfers
* Stellar Testnet

---

## MVP Flow

Resident contributes 50 USDC

↓

Treasurer creates withdrawal request

↓

President approves

↓

Secretary approves

↓

Funds are released

---

## Technology Stack

### Smart Contract

* Rust
* Soroban SDK v23

### Frontend

* Next.js
* TailwindCSS
* Freighter Wallet

### Network

* Stellar Testnet

---

## Contract Details

### Network

Stellar Testnet

### Contract ID

CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

### Explorer

https://stellar.expert/explorer/testnet/contract/CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

> Replace the contract ID above with your actual deployed contract address.

---

## Screenshots

### Dashboard

![Dashboard](images/dashboard.png)

### Contribute Page

![Contribution](images/contribute.png)

### Approval Page

![Approval](images/approval.png)

---

## Setup Guide

### Prerequisites

Install:

* Rust
* Soroban CLI
* Freighter Wallet
* Stellar Testnet account

### Build Contract

```bash
stellar contract build
```

### Run Tests

```bash
cargo test
```

### Deploy Contract

```bash
stellar contract deploy \
--network testnet \
--source alice \
--wasm target/wasm32v1-none/release/bayanihan_fund.wasm
```

---

## Project Structure

```text
bayanihan-fund/
├── images
│   ├── dashboard.png
│   ├── contribute.png
│   └── approval.png
├── src
│   ├── lib.rs
│   └── test.rs
├── Cargo.toml
├── README.md
└── Makefile
```

---

## Future Scope

Planned enhancements include:

* Mobile application support
* SMS notifications
* Anchor integration
* AI-powered expense categorization
* Analytics dashboard
* Additional officer approvals
* Offline transaction support
* Support for NGOs and cooperatives

---

## Why This Wins

### Real Community Problem

Floods, fires, and medical emergencies are common in many communities.

### Strong Soroban Use Case

Multi-step approvals naturally fit smart contracts.

### Real Money Movement

Bayanihan Fund coordinates actual financial transactions rather than simply storing information.

### Global Applicability

The system can be used in:

* Philippines
* Indonesia
* India
* Africa
* Latin America

---

## Timeline

### Day 1

Smart contract foundation

### Day 2

Contribution functionality

### Day 3

Withdrawal requests and approvals

### Day 4

Frontend integration

### Day 5

Testing and deployment

---

## License

MIT License
