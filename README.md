# Bayanihan Fund

Transparent Community Emergency Fund Powered by Stellar.

## Problem

Ramon, the president of a homeowners association in Parañaque City, Philippines, collects emergency contributions from residents through cash and spreadsheets. During floods and medical emergencies, members often question where the money goes, causing delays and mistrust.

## Solution

Residents contribute funds through a mobile web app. Soroban smart contracts transparently record contributions and require multiple officers to approve withdrawals before funds are released.

## Timeline

- Day 1: Smart contract setup and fund initialization
- Day 2: Contribution and withdrawal request logic
- Day 3: Officer approval and execution logic
- Day 4: Frontend integration with Freighter Wallet
- Day 5: Testnet deployment and demo preparation

## Stellar Features Used

- Soroban Smart Contracts
- USDC Transfers on Stellar Testnet

## Vision and Purpose

Bayanihan Fund aims to become a transparent treasury system for barangays, cooperatives, churches, NGOs, homeowners associations, and disaster response groups.

The purpose is to prevent misuse of emergency funds, build trust among community members, and enable faster response during floods, fires, and medical emergencies.

## Prerequisites

Install:

- Rust
- Stellar / Soroban CLI
- Soroban SDK v23
- Freighter Wallet
- Stellar Testnet account

## Build

```bash
soroban contract build