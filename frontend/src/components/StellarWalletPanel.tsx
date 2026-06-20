import { useState, type FormEvent } from "react";
import { useStellarWallet } from "../hooks/useStellarWallet";
import { STELLAR_EXPLORER_TX_URL, isValidStellarPublicKey, validateAmount, validateMemo } from "../lib/stellar";

function truncateAddress(address: string): string {
  return `${address.slice(0, 7)}…${address.slice(-7)}`;
}

export function StellarWalletPanel() {
  const wallet = useStellarWallet();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    await navigator.clipboard.writeText(wallet.publicKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!isValidStellarPublicKey(destination)) {
      setFormError("Enter a valid Stellar destination public key.");
      return;
    }
    const validationError = validateAmount(amount) || validateMemo(memo);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    try {
      await wallet.sendXlm(destination, amount, memo);
      setDestination("");
      setAmount("");
      setMemo("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Transaction failed.");
    }
  }

  return (
    <section className="wallet-grid" aria-label="Stellar wallet tools">
      <div className="card wallet-card">
        <div className="card-heading">
          <div><span className="step">01</span><h2>Your wallet</h2></div>
          {wallet.isConnected && <span className="connected-badge">Connected</span>}
        </div>

        {!wallet.isConnected ? (
          <div className="connect-state">
            <div className="wallet-orbit" aria-hidden="true"><span>F</span></div>
            <h3>Connect with Freighter</h3>
            <p>Approve access in your wallet to use your public Testnet account.</p>
            <button className="primary-button" onClick={wallet.connect} disabled={wallet.isConnecting}>
              {wallet.isConnecting ? "Waiting for Freighter…" : "Connect Freighter wallet"}
            </button>
            {wallet.freighterAvailable === false && (
              <p className="inline-message warning" role="alert">Freighter wallet is required. Install the browser extension and switch it to Testnet.</p>
            )}
          </div>
        ) : (
          <div className="account-state">
            <div className="address-row">
              <div><span className="label">Public key</span><code title={wallet.publicKey}>{truncateAddress(wallet.publicKey)}</code></div>
              <button className="icon-button" onClick={copyAddress} aria-label="Copy wallet public key">{copied ? "Copied" : "Copy"}</button>
            </div>
            <div className="balance-block">
              <span className="label">Testnet balance</span>
              <div className="balance-value">
                {wallet.isLoadingBalance ? <span className="skeleton">Loading…</span> : (
                  <><strong>{wallet.balance === null ? "—" : Number(wallet.balance).toLocaleString(undefined, { maximumFractionDigits: 7 })}</strong><span>XLM</span></>
                )}
              </div>
              <span className="spendable">Spendable: {wallet.spendableBalance.toFixed(7)} XLM</span>
            </div>
            <div className="button-row">
              <button className="secondary-button" onClick={() => wallet.fetchBalance()} disabled={wallet.isLoadingBalance}>Refresh balance</button>
              <button className="text-button" onClick={wallet.disconnect}>Disconnect</button>
            </div>
          </div>
        )}
      </div>

      <div className={`card send-card ${!wallet.isConnected ? "card-disabled" : ""}`}>
        <div className="card-heading">
          <div><span className="step">02</span><h2>Send XLM</h2></div>
          <span className="testnet-tag">Testnet only</span>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <label>
            <span>Destination public key</span>
            <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="G…" autoComplete="off" disabled={!wallet.isConnected || wallet.isSending} aria-describedby="destination-help" />
            <small id="destination-help">The receiving account must already exist on Testnet.</small>
          </label>
          <div className="form-row">
            <label>
              <span>Amount</span>
              <div className="input-suffix">
                <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.0000000" inputMode="decimal" disabled={!wallet.isConnected || wallet.isSending} />
                <span>XLM</span>
              </div>
            </label>
            <label>
              <span>Memo <em>optional</em></span>
              <input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Emergency support" maxLength={28} disabled={!wallet.isConnected || wallet.isSending} />
            </label>
          </div>

          {(formError || wallet.error) && <p className="inline-message error" role="alert">{formError || wallet.error}</p>}
          {wallet.txStatus === "pending" && <p className="inline-message pending" role="status">Confirm the transaction in Freighter…</p>}
          {wallet.txStatus === "success" && wallet.txHash && (
            <div className="success-message" role="status">
              <div><span aria-hidden="true">✓</span><p><strong>Payment confirmed</strong><br />Your Testnet balance has been refreshed.</p></div>
              <a href={`${STELLAR_EXPLORER_TX_URL}/${wallet.txHash}`} target="_blank" rel="noreferrer">View transaction ↗</a>
              <code>{wallet.txHash}</code>
            </div>
          )}
          <button className="primary-button send-button" type="submit" disabled={!wallet.isConnected || wallet.isSending}>
            {wallet.isSending ? "Sending on Testnet…" : wallet.isConnected ? "Review and send" : "Connect wallet to send"}
          </button>
        </form>
      </div>
    </section>
  );
}
