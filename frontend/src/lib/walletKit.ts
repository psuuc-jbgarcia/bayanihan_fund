import { STELLAR_NETWORK_PASSPHRASE } from "./stellar";
import {
  getNetwork as getFreighterNetwork,
  isConnected as isFreighterConnected,
  requestAccess,
  signTransaction as signFreighterTransaction,
} from "@stellar/freighter-api";

const SDK_URL = "https://esm.sh/@creit.tech/stellar-wallets-kit@2.3.0/sdk?bundle";
const MODULES_URL = "https://esm.sh/@creit.tech/stellar-wallets-kit@2.3.0/modules/utils?bundle";

type WalletKit = {
  init(params: {
    modules: unknown[];
    network: string;
    authModal?: { showInstallLabel?: boolean; hideUnsupportedWallets?: boolean };
  }): void;
  authModal(): Promise<{ address: string }>;
  refreshSupportedWallets(): Promise<Array<{ isAvailable: boolean; name: string }>>;
  signTransaction(xdr: string, options: { networkPassphrase: string; address: string }): Promise<{ signedTxXdr: string }>;
  disconnect(): Promise<void>;
};

let kitPromise: Promise<WalletKit> | null = null;
let activeWallet: "freighter" | "kit" | null = null;

type FreighterResult = {
  address?: string;
  error?: string | { message?: string };
  isConnected?: boolean;
  networkPassphrase?: string;
  signedTxXdr?: string;
};

function freighterError(result: unknown): string | null {
  const error = (result as FreighterResult | undefined)?.error;
  return typeof error === "string" ? error : error?.message || null;
}

export function getWalletKit(): Promise<WalletKit> {
  if (!kitPromise) {
    kitPromise = Promise.all([
      import(/* @vite-ignore */ SDK_URL),
      import(/* @vite-ignore */ MODULES_URL),
    ]).then(([sdk, moduleUtils]) => {
      const kit = sdk.StellarWalletsKit as WalletKit;
      const modules = moduleUtils.defaultModules({
        filterBy: (module: { productId: string }) =>
          ["freighter", "albedo", "xbull", "rabet", "lobstr", "hana"].includes(module.productId),
      });
      kit.init({
        modules,
        network: STELLAR_NETWORK_PASSPHRASE,
        authModal: { showInstallLabel: true, hideUnsupportedWallets: false },
      });
      return kit;
    });
  }
  return kitPromise;
}

export async function connectWallet(): Promise<string> {
  const freighterConnection: unknown = await isFreighterConnected();
  const freighterAvailable = typeof freighterConnection === "boolean"
    ? freighterConnection
    : Boolean((freighterConnection as FreighterResult | undefined)?.isConnected);
  if (freighterAvailable) {
    const networkResult: unknown = await getFreighterNetwork();
    const networkError = freighterError(networkResult);
    if (networkError) throw new Error(networkError);
    if ((networkResult as FreighterResult).networkPassphrase !== STELLAR_NETWORK_PASSPHRASE) {
      throw new Error("Switch Freighter to Testnet, then try again.");
    }
    const accessResult: unknown = await requestAccess();
    const accessError = freighterError(accessResult);
    if (accessError) throw new Error(accessError);
    const address = (accessResult as FreighterResult).address;
    if (!address) throw new Error("Freighter did not return an account address.");
    activeWallet = "freighter";
    return address;
  }

  const kit = await getWalletKit();
  const wallets = await kit.refreshSupportedWallets();
  if (!wallets.some((wallet) => wallet.isAvailable)) {
    throw new Error("NO_SUPPORTED_WALLET_EXTENSION");
  }
  const { address } = await kit.authModal();
  activeWallet = "kit";
  return address;
}

export async function disconnectWallet(): Promise<void> {
  if (activeWallet === "kit") await (await getWalletKit()).disconnect();
  activeWallet = null;
}

export async function signWithWallet(xdr: string, address: string): Promise<string> {
  if (activeWallet === "freighter") {
    const result: unknown = await signFreighterTransaction(xdr, {
      networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
      address,
    });
    const error = freighterError(result);
    if (error) throw new Error(error);
    const signedTxXdr = (result as FreighterResult).signedTxXdr;
    if (!signedTxXdr) throw new Error("Freighter did not return a signed transaction.");
    return signedTxXdr;
  }
  const result = await (await getWalletKit()).signTransaction(xdr, {
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
    address,
  });
  return result.signedTxXdr;
}
