import { useCallback, useEffect, useState } from "react";
import {
  CONTRACT_ID,
  contractConfigured,
  friendlyContractError,
  readContract,
  readContractAt,
  rpcServer,
  scAddress,
  scI128,
  scString,
  scU64,
  writeContract,
  type TransactionStage,
} from "../lib/soroban";
import { connectWallet, disconnectWallet } from "../lib/walletKit";

export type FundRequest = {
  id: bigint;
  amount: bigint;
  purpose: string;
  recipient: string;
  president_approved: boolean;
  secretary_approved: boolean;
  executed: boolean;
};

type FundRoles = { treasurer: string; president: string; secretary: string; token: string };
type TxState = { action: string; stage: TransactionStage; hash?: string } | null;

export function useBayanihanFund() {
  const [publicKey, setPublicKey] = useState("");
  const [balance, setBalance] = useState(0n);
  const [availableBalance, setAvailableBalance] = useState(0n);
  const [contribution, setContribution] = useState(0n);
  const [walletBalance, setWalletBalance] = useState(0n);
  const [roles, setRoles] = useState<FundRoles | null>(null);
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [tx, setTx] = useState<TxState>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [needsWallet, setNeedsWallet] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicKey || !contractConfigured) return;
    setLoading(true);
    try {
      const [fundBalance, available, totalContribution, config, count] = await Promise.all([
        readContract<bigint>(publicKey, "get_balance"),
        readContract<bigint>(publicKey, "get_available_balance"),
        readContract<bigint>(publicKey, "get_contribution", [scAddress(publicKey)]),
        readContract<FundRoles>(publicKey, "get_roles"),
        readContract<bigint>(publicKey, "get_request_count"),
      ]);
      const ids = Array.from({ length: Number(count) }, (_, index) => BigInt(index + 1));
      const loadedRequests = await Promise.all(
        ids.map((id) => readContract<FundRequest>(publicKey, "get_request", [scU64(id)])),
      );
      const connectedWalletBalance = await readContractAt<bigint>(
        config.token,
        publicKey,
        "balance",
        [scAddress(publicKey)],
      );
      setBalance(fundBalance);
      setAvailableBalance(available);
      setContribution(totalContribution);
      setWalletBalance(connectedWalletBalance);
      setRoles(config);
      setRequests(loadedRequests.reverse());
      setLastSynced(new Date());
      setError(null);
    } catch (caught) {
      setError(friendlyContractError(caught));
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  const connect = useCallback(async () => {
    setError(null);
    setNeedsWallet(false);
    try {
      const address = await connectWallet();
      setPublicKey(address);
    } catch (caught) {
      const message = friendlyContractError(caught);
      const unavailable = /fetch|module|network|not installed|not found|not available|extension|NO_SUPPORTED_WALLET/i.test(message);
      setNeedsWallet(unavailable);
      setError(unavailable
        ? "No supported wallet was found, or the wallet selector could not load."
        : message);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet().catch(() => undefined);
    setPublicKey("");
    setWalletBalance(0n);
    setNeedsWallet(false);
    setRoles(null);
    setRequests([]);
    setTx(null);
  }, []);

  const submit = useCallback(async (action: string, method: string, args: ReturnType<typeof scAddress>[]) => {
    if (!publicKey) throw new Error("Connect a wallet first.");
    setError(null);
    try {
      await writeContract(publicKey, method, args, (stage, hash) => setTx({ action, stage, hash }));
      await refresh();
    } catch (caught) {
      setError(friendlyContractError(caught));
      throw caught;
    }
  }, [publicKey, refresh]);

  const contribute = useCallback((amount: bigint) => {
    if (amount > walletBalance) {
      throw new Error("Insufficient wallet token balance for this contribution.");
    }
    return submit("Contribution", "contribute", [scAddress(publicKey), scI128(amount)]);
  }, [publicKey, submit, walletBalance]);

  const createRequest = useCallback((amount: bigint, purpose: string, recipient: string) =>
    submit("Create request", "create_request", [
      scAddress(publicKey), scI128(amount), scString(purpose), scAddress(recipient),
    ]), [publicKey, submit]);

  const approveRequest = useCallback((id: bigint) =>
    submit("Approve request", "approve_request", [scAddress(publicKey), scU64(id)]), [publicKey, submit]);

  const executeRequest = useCallback((id: bigint) =>
    submit("Execute request", "execute_request", [scU64(id)]), [submit]);

  useEffect(() => {
    if (!publicKey || !contractConfigured) return;
    let active = true;
    let cursor = "";
    let startLedger = 0;
    const poll = async () => {
      try {
        if (!startLedger) startLedger = (await rpcServer.getLatestLedger()).sequence;
        const response = cursor
          ? await rpcServer.getEvents({ filters: [{ type: "contract", contractIds: [CONTRACT_ID] }], cursor, limit: 100 })
          : await rpcServer.getEvents({ filters: [{ type: "contract", contractIds: [CONTRACT_ID] }], startLedger, limit: 100 });
        if (!active) return;
        cursor = response.cursor;
        startLedger = response.latestLedger;
        if (response.events.length) await refresh();
      } catch {
        // A later poll retries; read errors remain visible through refresh.
      }
    };
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      active = false;
      window.clearTimeout(initialRefresh);
      window.clearInterval(timer);
    };
  }, [publicKey, refresh]);

  return {
    mode: "live" as const,
    activeRole: null,
    setActiveRole: (role: "Resident" | "Treasurer" | "President" | "Secretary") => void role,
    activity: [],
    needsWallet,
    publicKey, balance, availableBalance, contribution, walletBalance, roles, requests, tx, error,
    loading, lastSynced, contractConfigured, connect, disconnect, refresh,
    contribute, createRequest, approveRequest, executeRequest,
  };
}
