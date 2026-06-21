import * as StellarSdk from "@stellar/stellar-sdk";
import { STELLAR_NETWORK_PASSPHRASE } from "./stellar";
import { signWithWallet } from "./walletKit";

export const SOROBAN_RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
export const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID || "";
export const TOKEN_SYMBOL = import.meta.env.VITE_TOKEN_SYMBOL || "XLM";
export const contractConfigured = StellarSdk.StrKey.isValidContract(CONTRACT_ID);
export const rpcServer = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);

const contract = contractConfigured ? new StellarSdk.Contract(CONTRACT_ID) : null;

function configuredContract(): StellarSdk.Contract {
  if (!contract) throw new Error("Set VITE_CONTRACT_ID to the deployed Testnet contract address.");
  return contract;
}

function buildCall(account: StellarSdk.Account, target: StellarSdk.Contract, method: string, args: StellarSdk.xdr.ScVal[]) {
  return new StellarSdk.TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(target.call(method, ...args))
    .setTimeout(60)
    .build();
}

export const scAddress = (value: string) => new StellarSdk.Address(value).toScVal();
export const scI128 = (value: bigint) => StellarSdk.nativeToScVal(value, { type: "i128" });
export const scU64 = (value: bigint) => StellarSdk.nativeToScVal(value, { type: "u64" });
export const scString = (value: string) => StellarSdk.nativeToScVal(value, { type: "string" });

export async function readContract<T>(source: string, method: string, args: StellarSdk.xdr.ScVal[] = []): Promise<T> {
  return readContractAt<T>(CONTRACT_ID, source, method, args);
}

export async function readContractAt<T>(contractId: string, source: string, method: string, args: StellarSdk.xdr.ScVal[] = []): Promise<T> {
  const account = await rpcServer.getAccount(source);
  const target = new StellarSdk.Contract(contractId);
  const simulation = await rpcServer.simulateTransaction(buildCall(account, target, method, args));
  if (!StellarSdk.rpc.Api.isSimulationSuccess(simulation) || !simulation.result) {
    const detail = "error" in simulation ? simulation.error : "Contract simulation failed.";
    throw new Error(String(detail));
  }
  return StellarSdk.scValToNative(simulation.result.retval) as T;
}

export type TransactionStage = "signing" | "pending" | "success" | "failed";

export async function writeContract(
  source: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
  onStage: (stage: TransactionStage, hash?: string) => void,
): Promise<string> {
  const account = await rpcServer.getAccount(source);
  const prepared = await rpcServer.prepareTransaction(buildCall(account, configuredContract(), method, args));
  onStage("signing");
  const signedXdr = await signWithWallet(prepared.toXDR(), source);
  const signed = StellarSdk.TransactionBuilder.fromXDR(signedXdr, STELLAR_NETWORK_PASSPHRASE);
  const submitted = await rpcServer.sendTransaction(signed);
  if (submitted.status === "ERROR") {
    onStage("failed", submitted.hash);
    throw new Error("The RPC server rejected the transaction.");
  }

  onStage("pending", submitted.hash);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
    const result = await rpcServer.getTransaction(submitted.hash);
    if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
      onStage("success", submitted.hash);
      return submitted.hash;
    }
    if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
      onStage("failed", submitted.hash);
      throw new Error("The contract transaction failed on-chain.");
    }
  }
  onStage("failed", submitted.hash);
  throw new Error("Transaction confirmation timed out. Check the explorer before retrying.");
}

export function parseTokenAmount(value: string): bigint {
  if (!/^\d+(\.\d{1,7})?$/.test(value) || Number(value) <= 0) {
    throw new Error("Enter a positive amount with up to 7 decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0"));
}

export function formatTokenAmount(value: bigint): string {
  const whole = value / 10_000_000n;
  const fraction = (value % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function friendlyContractError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/User declined|rejected|denied/i.test(message)) return "The wallet request was rejected.";
  if (/Error\(Contract, #1\)/.test(message)) return "Amount must be greater than zero.";
  if (/Error\(Contract, #2\)/.test(message)) return "This wallet is not authorized for that action.";
  if (/Error\(Contract, #3\)|insufficient/i.test(message)) return "The account or fund has insufficient balance.";
  if (/Error\(Contract, #4\)/.test(message)) return "Withdrawal request not found.";
  if (/Error\(Contract, #5\)/.test(message)) return "This request has already been executed.";
  if (/Error\(Contract, #6\)/.test(message)) return "Both officer approvals are required.";
  if (/Error\(Contract, #8\)/.test(message)) return "Enter a purpose between 1 and 160 characters.";
  if (/Error\(Contract, #9\)/.test(message)) return "This officer has already approved the request.";
  return message;
}
