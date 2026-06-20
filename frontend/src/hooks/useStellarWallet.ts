import { useCallback, useEffect, useState } from "react";
import { getAddress, getNetwork, isConnected, setAllowed, signTransaction } from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  friendlyStellarError, getSpendableXlm, isValidStellarPublicKey, server,
  STELLAR_NETWORK, STELLAR_NETWORK_PASSPHRASE, validateAmount, validateMemo,
} from "../lib/stellar";

const STORAGE_KEY = "bayanihan:wallet-connected";
type TxStatus = "idle" | "pending" | "success" | "error";
type ApiObject = {
  address?: string;
  error?: string | { message?: string };
  isAllowed?: boolean;
  isConnected?: boolean;
  network?: string;
  networkPassphrase?: string;
  signedTxXdr?: string;
};

function apiError(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const error = (result as ApiObject).error;
  if (!error) return null;
  return typeof error === "string" ? error : error.message || "Freighter returned an error.";
}

function readString(result: unknown, key: keyof ApiObject): string | null {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return null;
  const value = (result as ApiObject)[key];
  return typeof value === "string" ? value : null;
}

function connectionAvailable(result: unknown): boolean {
  return typeof result === "boolean" ? result : Boolean((result as ApiObject | undefined)?.isConnected);
}

async function assertTestnet(): Promise<void> {
  const result: unknown = await getNetwork();
  const error = apiError(result);
  if (error) throw new Error(error);
  const network = readString(result, "network");
  const passphrase = readString(result, "networkPassphrase");
  if (network?.toUpperCase() !== STELLAR_NETWORK && passphrase !== STELLAR_NETWORK_PASSPHRASE) {
    throw new Error("Switch Freighter to Testnet, then try again.");
  }
}

export function useStellarWallet() {
  const [publicKey, setPublicKey] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [spendableBalance, setSpendableBalance] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [freighterAvailable, setFreighterAvailable] = useState<boolean | null>(null);

  const fetchBalance = useCallback(async (address = publicKey) => {
    if (!address) return;
    setIsLoadingBalance(true);
    setError(null);
    try {
      const account = await server.loadAccount(address);
      const native = account.balances.find((item) => item.asset_type === "native");
      setBalance(native?.balance ?? "0");
      setSpendableBalance(getSpendableXlm(account));
    } catch (caught) {
      setBalance(null);
      setSpendableBalance(0);
      setError(friendlyStellarError(caught, "Could not load the XLM balance from Stellar Testnet."));
    } finally {
      setIsLoadingBalance(false);
    }
  }, [publicKey]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setTxStatus("idle");
    try {
      const connectedResult: unknown = await isConnected();
      const available = connectionAvailable(connectedResult);
      setFreighterAvailable(available);
      if (!available) throw new Error("Freighter wallet is required. Install the extension and switch it to Testnet.");

      const allowedResult: unknown = await setAllowed();
      const allowedError = apiError(allowedResult);
      if (allowedError) throw new Error(allowedError);
      if (typeof allowedResult === "object" && allowedResult && (allowedResult as ApiObject).isAllowed === false) {
        throw new Error("Wallet connection was declined in Freighter.");
      }

      await assertTestnet();
      const addressResult: unknown = await getAddress();
      const addressError = apiError(addressResult);
      if (addressError) throw new Error(addressError);
      const address = readString(addressResult, "address");
      if (!address || !isValidStellarPublicKey(address)) throw new Error("Freighter returned an unexpected wallet address.");

      setPublicKey(address);
      localStorage.setItem(STORAGE_KEY, "true");
      await fetchBalance(address);
    } catch (caught) {
      setError(friendlyStellarError(caught, "Could not connect to Freighter."));
    } finally {
      setIsConnecting(false);
    }
  }, [fetchBalance]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPublicKey("");
    setBalance(null);
    setSpendableBalance(0);
    setError(null);
    setTxHash(null);
    setTxStatus("idle");
  }, []);

  const sendXlm = useCallback(async (destination: string, amount: string, memo: string) => {
    if (!publicKey) throw new Error("Connect your Freighter wallet first.");
    if (!isValidStellarPublicKey(destination)) throw new Error("Enter a valid Stellar destination public key.");
    const amountError = validateAmount(amount);
    if (amountError) throw new Error(amountError);
    const memoError = validateMemo(memo);
    if (memoError) throw new Error(memoError);
    if (Number(amount) > spendableBalance) {
      throw new Error(`Insufficient spendable balance. Up to ${spendableBalance.toFixed(7)} XLM is available after reserve and fees.`);
    }

    setIsSending(true);
    setError(null);
    setTxHash(null);
    setTxStatus("pending");
    try {
      await assertTestnet();
      try {
        await server.loadAccount(destination.trim());
      } catch (caught) {
        if ((caught as { response?: { status?: number } })?.response?.status === 404) {
          throw new Error("The destination account does not exist on Stellar Testnet.", { cause: caught });
        }
        throw caught;
      }

      const sourceAccount = await server.loadAccount(publicKey);
      const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      }).addOperation(StellarSdk.Operation.payment({
        destination: destination.trim(),
        asset: StellarSdk.Asset.native(),
        amount: amount.trim(),
      }));
      if (memo.trim()) builder.addMemo(StellarSdk.Memo.text(memo.trim()));
      const transaction = builder.setTimeout(180).build();

      const signedResult: unknown = await signTransaction(transaction.toXDR(), {
        networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
        address: publicKey,
      });
      const signingError = apiError(signedResult);
      if (signingError) throw new Error(signingError);
      const signedTxXdr = readString(signedResult, "signedTxXdr");
      if (!signedTxXdr) throw new Error("Freighter returned an unexpected signed transaction.");

      const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, STELLAR_NETWORK_PASSPHRASE);
      const response = await server.submitTransaction(signedTransaction);
      setTxHash(response.hash);
      setTxStatus("success");
      await fetchBalance(publicKey);
      return response.hash;
    } catch (caught) {
      const message = friendlyStellarError(caught, "The Testnet transaction could not be submitted.");
      setError(message);
      setTxStatus("error");
      console.error("Stellar Testnet transaction failed", caught);
      throw new Error(message, { cause: caught });
    } finally {
      setIsSending(false);
    }
  }, [fetchBalance, publicKey, spendableBalance]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const available = connectionAvailable(await isConnected());
        if (active) setFreighterAvailable(available);
        if (!available || localStorage.getItem(STORAGE_KEY) !== "true") return;
        await assertTestnet();
        const address = readString(await getAddress(), "address");
        if (active && address && isValidStellarPublicKey(address)) {
          setPublicKey(address);
          await fetchBalance(address);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
    return () => { active = false; };
  }, [fetchBalance]);

  return {
    publicKey, isConnected: Boolean(publicKey), balance, spendableBalance,
    isConnecting, isLoadingBalance, isSending, error, txHash, txStatus,
    freighterAvailable, connect, disconnect, fetchBalance, sendXlm,
  };
}
