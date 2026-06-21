import { useCallback, useMemo, useState } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import type { FundRequest } from "./useBayanihanFund";
import type { TransactionStage } from "../lib/soroban";

export type DemoRole = "Resident" | "Treasurer" | "President" | "Secretary";

const addresses: Record<DemoRole, string> = {
  Resident: StellarSdk.Keypair.random().publicKey(),
  Treasurer: StellarSdk.Keypair.random().publicKey(),
  President: StellarSdk.Keypair.random().publicKey(),
  Secretary: StellarSdk.Keypair.random().publicKey(),
};
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function useDemoFund() {
  const [activeRole, setActiveRole] = useState<DemoRole>("Resident");
  const [balance, setBalance] = useState(0n);
  const [availableBalance, setAvailableBalance] = useState(0n);
  const [walletBalances, setWalletBalances] = useState<Record<DemoRole, bigint>>({ Resident: 100_000_000_00n, Treasurer: 100_000_000_00n, President: 100_000_000_00n, Secretary: 100_000_000_00n });
  const [contributions, setContributions] = useState<Record<DemoRole, bigint>>({ Resident: 0n, Treasurer: 0n, President: 0n, Secretary: 0n });
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [tx, setTx] = useState<{ action: string; stage: TransactionStage; hash?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState(new Date());
  const roles = useMemo(() => ({ treasurer: addresses.Treasurer, president: addresses.President, secretary: addresses.Secretary, token: "demo" }), []);

  const simulate = useCallback(async (action: string, update: () => void) => {
    setError(null);
    setTx({ action, stage: "signing" });
    await wait(350);
    setTx({ action, stage: "pending", hash: "demo-transaction" });
    await wait(550);
    update();
    setLastSynced(new Date());
    setTx({ action, stage: "success", hash: "demo-transaction" });
  }, []);

  const contribute = useCallback(async (amount: bigint) => {
    if (amount > walletBalances[activeRole]) throw new Error("Insufficient demo wallet balance.");
    await simulate("Contribution", () => {
      setWalletBalances((value) => ({ ...value, [activeRole]: value[activeRole] - amount }));
      setContributions((value) => ({ ...value, [activeRole]: value[activeRole] + amount }));
      setBalance((value) => value + amount);
      setAvailableBalance((value) => value + amount);
    });
  }, [activeRole, simulate, walletBalances]);

  const createRequest = useCallback(async (amount: bigint, purpose: string, recipient: string) => {
    if (activeRole !== "Treasurer") throw new Error("Switch to Treasurer to create a request.");
    if (amount > availableBalance) throw new Error("The demo fund has insufficient available balance.");
    await simulate("Create request", () => {
      const id = BigInt(requests.length + 1);
      setRequests((value) => [{ id, amount, purpose, recipient, president_approved: false, secretary_approved: false, executed: false }, ...value]);
      setAvailableBalance((value) => value - amount);
    });
  }, [activeRole, availableBalance, requests.length, simulate]);

  const approveRequest = useCallback(async (id: bigint) => {
    if (activeRole !== "President" && activeRole !== "Secretary") throw new Error("Switch to President or Secretary to approve.");
    await simulate("Approve request", () => setRequests((value) => value.map((request) => request.id !== id ? request : {
      ...request,
      president_approved: request.president_approved || activeRole === "President",
      secretary_approved: request.secretary_approved || activeRole === "Secretary",
    })));
  }, [activeRole, simulate]);

  const executeRequest = useCallback(async (id: bigint) => {
    const request = requests.find((item) => item.id === id);
    if (!request?.president_approved || !request.secretary_approved) throw new Error("Both approvals are required.");
    await simulate("Execute request", () => {
      setRequests((value) => value.map((item) => item.id === id ? { ...item, executed: true } : item));
      setBalance((value) => value - request.amount);
    });
  }, [requests, simulate]);

  return {
    mode: "demo" as const,
    activeRole,
    setActiveRole,
    activity: [],
    needsWallet: false,
    publicKey: addresses[activeRole],
    balance,
    availableBalance,
    contribution: contributions[activeRole],
    walletBalance: walletBalances[activeRole],
    roles,
    requests,
    tx,
    error,
    loading: false,
    lastSynced,
    contractConfigured: true,
    connect: async () => undefined,
    disconnect: async () => undefined,
    refresh: async () => setLastSynced(new Date()),
    contribute,
    createRequest,
    approveRequest,
    executeRequest,
  };
}
