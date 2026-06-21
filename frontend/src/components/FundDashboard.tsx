import { useState, type FormEvent } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useBayanihanFund } from "../hooks/useBayanihanFund";
import { useDemoFund, type DemoRole } from "../hooks/useDemoFund";
import { CONTRACT_ID, TOKEN_SYMBOL, formatTokenAmount, parseTokenAmount } from "../lib/soroban";

const explorerBase = "https://stellar.expert/explorer/testnet";
const shortAddress = (value: string) => value ? `${value.slice(0, 6)}...${value.slice(-6)}` : "";
const walletInstallUrl = navigator.userAgent.includes("Firefox")
  ? "https://addons.mozilla.org/firefox/addon/freighter/"
  : "https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk";

type FundDashboardProps = { onExit?: () => void };

export function FundDashboard({ onExit }: FundDashboardProps) {
  const liveFund = useBayanihanFund();
  const demoFund = useDemoFund();
  const [appMode, setAppMode] = useState<"demo" | "live">(liveFund.contractConfigured ? "live" : "demo");
  const fund = appMode === "demo" ? demoFund : liveFund;
  const [contributionAmount, setContributionAmount] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [recipient, setRecipient] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<"open" | "all" | "executed">("open");
  const busy = fund.tx?.stage === "signing" || fund.tx?.stage === "pending";
  const isTreasurer = fund.publicKey === fund.roles?.treasurer;
  const isOfficer = fund.publicKey === fund.roles?.president || fund.publicKey === fund.roles?.secretary;
  const tokenLabel = appMode === "demo" ? "Demo tokens" : TOKEN_SYMBOL;
  const liveContractUnavailable = appMode === "live" && !fund.contractConfigured;
  const activeRole = appMode === "demo" ? demoFund.activeRole : isTreasurer ? "Treasurer" : isOfficer ? "Officer" : "Contributor";
  const filteredRequests = fund.requests.filter((request) => requestFilter === "all" || (requestFilter === "open" ? !request.executed : request.executed));
  let exceedsWalletBalance = false;
  if (fund.publicKey && contributionAmount && !liveContractUnavailable) {
    try {
      exceedsWalletBalance = parseTokenAmount(contributionAmount) > fund.walletBalance;
    } catch {
      exceedsWalletBalance = false;
    }
  }

  async function handleContribution(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      if (!fund.publicKey) {
        await fund.connect();
        return;
      }
      await fund.contribute(parseTokenAmount(contributionAmount));
      setContributionAmount("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Contribution failed.");
    }
  }

  async function handleRequest(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      if (!purpose.trim()) throw new Error("Enter a purpose.");
      const recipientAddress = recipient.trim() || fund.publicKey;
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(recipientAddress)) throw new Error("Enter a valid recipient address.");
      await fund.createRequest(parseTokenAmount(requestAmount), purpose.trim(), recipientAddress);
      setRequestAmount("");
      setPurpose("");
      setRecipient("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not create the request.");
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">B</span><div><strong>Bayanihan Fund</strong><small>Community treasury</small></div></div>
        <div className="topbar-actions">
          {onExit && <button className="quiet-button overview-button" onClick={onExit}>Overview</button>}
          <div className="mode-switch" aria-label="Application mode">
            <button className={appMode === "demo" ? "selected" : ""} onClick={() => setAppMode("demo")}>Demo</button>
            <button className={appMode === "live" ? "selected" : ""} onClick={() => setAppMode("live")}>Live</button>
          </div>
          <span className="network-status"><i />{appMode === "demo" ? "Sandbox" : "Testnet"}</span>
          {appMode === "demo" ? (
            <select className="role-select" value={demoFund.activeRole} onChange={(event) => demoFund.setActiveRole(event.target.value as DemoRole)} aria-label="Active demo role">
              <option>Resident</option><option>Treasurer</option><option>President</option><option>Secretary</option>
            </select>
          ) : fund.publicKey ? (
            <><code title={fund.publicKey}>{shortAddress(fund.publicKey)}</code><button className="quiet-button" onClick={fund.disconnect}>Disconnect</button></>
          ) : <button className="primary-button" onClick={fund.connect}>Connect wallet</button>}
        </div>
      </header>

      <section className="mvp-note" role="note">
        <strong>{appMode === "demo" ? "Empty Demo" : "Testnet MVP"}</strong>
        <span>{appMode === "demo" ? "Interactive sandbox with no preloaded fund balance or requests." : "Every action requires wallet confirmation. Testnet assets have no real-world value."}</span>
      </section>

      {appMode === "live" && !fund.contractConfigured && (
        <section className="setup-banner" role="alert">
          <strong>Contract configuration required</strong>
          <span>Set <code>VITE_CONTRACT_ID</code> in <code>frontend/.env</code> after deploying the contract.</span>
        </section>
      )}

      <section className="page-heading">
        <div>
          <p className="eyebrow">Paranaque Community Chapter</p>
          <h1>Bayanihan emergency fund</h1>
          <div className="account-context"><span>{activeRole}</span><code title={fund.publicKey}>{shortAddress(fund.publicKey)}</code></div>
        </div>
        <div className="sync-state">
          <span className={fund.loading ? "sync-dot active" : "sync-dot"} />
          {fund.lastSynced ? `Synced ${fund.lastSynced.toLocaleTimeString()}` : "Waiting for wallet"}
          {fund.publicKey && <button className="icon-button" title="Refresh contract state" aria-label="Refresh contract state" onClick={() => fund.refresh()}>↻</button>}
        </div>
      </section>

      <section className="metrics" aria-label="Fund totals">
        <div><span>Total fund</span><strong>{formatTokenAmount(fund.balance)}</strong><small>{tokenLabel}</small></div>
        <div><span>Available</span><strong>{formatTokenAmount(fund.availableBalance)}</strong><small>{tokenLabel} after reservations</small></div>
        <div><span>Wallet balance</span><strong>{formatTokenAmount(fund.walletBalance)}</strong><small>{tokenLabel} · {formatTokenAmount(fund.contribution)} contributed</small></div>
        <div><span>Open requests</span><strong>{fund.requests.filter((request) => !request.executed).length}</strong><small>{fund.requests.length} total</small></div>
      </section>

      {(formError || fund.error) && <p className="error-banner" role="alert">{formError || fund.error}</p>}
      {appMode === "live" && fund.needsWallet && (
        <section className="wallet-install-prompt" role="dialog" aria-labelledby="wallet-install-title">
          <div>
            <strong id="wallet-install-title">Install a Stellar wallet</strong>
            <span>No supported wallet extension was detected. Install Freighter, confirm it in your browser, then retry.</span>
          </div>
          <div className="wallet-install-actions">
            <a className="primary-button" href={walletInstallUrl} target="_blank" rel="noreferrer">Open extension store</a>
            <button className="secondary-button" onClick={fund.connect}>Try again</button>
          </div>
        </section>
      )}
      {fund.tx && (
        <section className={`tx-strip ${fund.tx.stage}`} aria-live="polite">
          <div><span className="tx-indicator" /><strong>{fund.tx.action}</strong><span>{fund.tx.stage === "signing" ? "Awaiting wallet signature" : fund.tx.stage}</span></div>
          {appMode === "live" && fund.tx.hash && <a href={`${explorerBase}/tx/${fund.tx.hash}`} target="_blank" rel="noreferrer">View transaction</a>}
        </section>
      )}

      <section className="workspace-grid">
        <div className="action-panel">
          <div className="section-heading"><div><p className="eyebrow">Write to contract</p><h2>Fund actions</h2></div></div>
          <form onSubmit={(event) => void handleContribution(event)}>
            <h3>Contribute</h3>
            <label><span>Amount</span><div className="amount-input"><input value={contributionAmount} onChange={(event) => setContributionAmount(event.target.value)} placeholder="50.0000000" inputMode="decimal" disabled={busy || liveContractUnavailable} /><span>{appMode === "demo" ? "TEST" : TOKEN_SYMBOL}</span></div></label>
            <div className="amount-presets" aria-label="Quick contribution amounts">
              {["10", "50", "100"].map((amount) => <button type="button" key={amount} className={contributionAmount === amount ? "selected" : ""} onClick={() => setContributionAmount(amount)} disabled={busy}>{amount}</button>)}
            </div>
            {fund.publicKey && !liveContractUnavailable && <small className={exceedsWalletBalance ? "balance-help insufficient" : "balance-help"}>Available: {formatTokenAmount(fund.walletBalance)} {tokenLabel}</small>}
            {liveContractUnavailable && <p className="permission-note">Deploy the contract and set <code>VITE_CONTRACT_ID</code> to enable Live contributions.</p>}
            {exceedsWalletBalance && <p className="field-error" role="alert">Insufficient wallet balance. Enter an amount up to {formatTokenAmount(fund.walletBalance)} {tokenLabel}.</p>}
            <button className="primary-button" disabled={busy || exceedsWalletBalance || liveContractUnavailable}>{liveContractUnavailable ? "Contract configuration required" : fund.publicKey ? "Contribute tokens" : "Connect wallet to contribute"}</button>
          </form>

          <form className={!isTreasurer ? "restricted-form" : ""} onSubmit={(event) => void handleRequest(event)}>
            <div className="form-title"><h3>Create withdrawal</h3>{!isTreasurer && <span>Treasurer only</span>}</div>
            {!isTreasurer && <p className="permission-note">Connect the treasurer wallet or select the Treasurer demo role.</p>}
            <label><span>Amount</span><input value={requestAmount} onChange={(event) => setRequestAmount(event.target.value)} placeholder="30.0000000" inputMode="decimal" disabled={!isTreasurer || busy} /></label>
            <label><span>Purpose</span><input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Flood emergency supplies" disabled={!isTreasurer || busy} /></label>
            <label><span>Recipient</span><input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="G..." disabled={!isTreasurer || busy} /></label>
            <button className="secondary-button" disabled={!isTreasurer || busy}>Create request</button>
          </form>
        </div>

        <div className="operations-stack">
        <div className="requests-panel">
          <div className="section-heading">
            <div><p className="eyebrow">Live contract state</p><h2>Withdrawal requests</h2></div>
            <div className="request-heading-actions">
              <div className="request-filters" aria-label="Filter withdrawal requests">
                {(["open", "all", "executed"] as const).map((filter) => <button key={filter} className={requestFilter === filter ? "selected" : ""} onClick={() => setRequestFilter(filter)}>{filter}</button>)}
              </div>
              {CONTRACT_ID && <a href={`${explorerBase}/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer">Contract</a>}
            </div>
          </div>
          {!fund.publicKey ? <div className="empty-state">Connect a wallet to read fund activity.</div>
            : filteredRequests.length === 0 ? <div className="empty-state"><strong>{requestFilter === "executed" ? "No completed requests" : "No open withdrawal requests"}</strong><span>{isTreasurer ? "New requests will appear here after creation." : "The treasurer has not created a request in this view."}</span></div>
            : <div className="request-list">
              {filteredRequests.map((request) => {
                const currentOfficerApproved = fund.publicKey === fund.roles?.president ? request.president_approved : fund.publicKey === fund.roles?.secretary ? request.secretary_approved : false;
                return (
                <article className="request-row" key={request.id.toString()}>
                  <div className="request-main">
                    <div className="request-id">#{request.id.toString()}</div>
                    <div><h3>{request.purpose}</h3><code title={request.recipient}>{shortAddress(request.recipient)}</code></div>
                    <strong>{formatTokenAmount(request.amount)}</strong>
                  </div>
                  <div className="approval-row">
                    <span className={request.president_approved ? "approved" : ""}>President {request.president_approved ? "approved" : "waiting"}</span>
                    <span className={request.secretary_approved ? "approved" : ""}>Secretary {request.secretary_approved ? "approved" : "waiting"}</span>
                    <span className={request.executed ? "executed" : ""}>{request.executed ? "Executed" : "Pending"}</span>
                    <div className="request-actions">
                      {isOfficer && !request.executed && !currentOfficerApproved && <button className="quiet-button" disabled={busy} onClick={() => void fund.approveRequest(request.id)}>Approve</button>}
                      {isOfficer && !request.executed && currentOfficerApproved && <span className="done-label">Your approval is recorded</span>}
                      {!request.executed && request.president_approved && request.secretary_approved && <button className="primary-button compact" disabled={busy} onClick={() => void fund.executeRequest(request.id)}>Execute</button>}
                    </div>
                  </div>
                </article>
              )})}
            </div>}
        </div>
        </div>
      </section>
    </main>
  );
}
