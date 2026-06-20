import * as StellarSdk from "@stellar/stellar-sdk";

export const STELLAR_NETWORK = "TESTNET" as const;
export const STELLAR_NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
export const STELLAR_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_EXPLORER_TX_URL = "https://stellar.expert/explorer/testnet/tx";

export const server = new StellarSdk.Horizon.Server(STELLAR_HORIZON_URL);

const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/;

export function isValidStellarPublicKey(value: string): boolean {
  try {
    return StellarSdk.StrKey.isValidEd25519PublicKey(value.trim());
  } catch {
    return false;
  }
}

export function validateAmount(value: string): string | null {
  if (!value.trim()) return "Enter an amount.";
  if (!AMOUNT_PATTERN.test(value.trim())) return "Use a positive number with no more than 7 decimal places.";
  if (Number(value) <= 0) return "Amount must be greater than zero.";
  return null;
}

export function validateMemo(value: string): string | null {
  return new TextEncoder().encode(value).length > 28 ? "Memo text must be 28 bytes or fewer." : null;
}

export function getSpendableXlm(account: StellarSdk.Horizon.AccountResponse): number {
  const native = account.balances.find((item) => item.asset_type === "native");
  if (!native) return 0;
  const minimumBalance = 0.5 * (2 + account.subentry_count + Number(account.num_sponsoring ?? 0) - Number(account.num_sponsored ?? 0));
  const feeBuffer = Number(StellarSdk.BASE_FEE) / 10_000_000;
  return Math.max(0, Number(native.balance) - Number(native.selling_liabilities ?? 0) - minimumBalance - feeBuffer);
}

export function friendlyStellarError(error: unknown, fallback: string): string {
  const value = error as {
    message?: string;
    response?: { status?: number; data?: { extras?: { result_codes?: { transaction?: string } } } };
  };
  if (value?.response?.status === 404) return "This Testnet account is not funded yet. Fund it with Friendbot, then refresh.";
  const resultCode = value?.response?.data?.extras?.result_codes?.transaction;
  if (resultCode === "tx_bad_auth") return "Freighter did not provide a valid signature for this transaction.";
  if (resultCode === "tx_insufficient_balance") return "The account does not have enough spendable XLM.";
  if (resultCode === "tx_bad_seq") return "The account changed while sending. Please try again.";
  return value?.message || fallback;
}
