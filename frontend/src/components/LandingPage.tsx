type LandingPageProps = { onOpenMvp: () => void };

export function LandingPage({ onOpenMvp }: LandingPageProps) {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <header className="landing-nav">
          <a className="landing-brand" href="#purpose" aria-label="Bayanihan Fund home">
            <span className="brand-mark">B</span><strong>Bayanihan Fund</strong>
          </a>
          <button className="hero-nav-button" onClick={onOpenMvp}>Open pitch MVP</button>
        </header>
        <div className="hero-content">
          <p className="hero-kicker">Transparent emergency support for every community</p>
          <h1>Bayanihan Fund</h1>
          <p>Neighbors contribute together. Trusted officers approve urgent requests. Every release of funds remains visible on Stellar.</p>
          <div className="hero-actions">
            <button className="hero-primary" onClick={onOpenMvp}>Explore the interactive MVP</button>
            <a href="#purpose">Why it matters</a>
          </div>
        </div>
        <div className="hero-proof">
          <span>Community funded</span><span>Multi-officer approval</span><span>Public audit trail</span>
        </div>
      </section>

      <section className="purpose-section" id="purpose">
        <div className="landing-container purpose-layout">
          <div>
            <p className="landing-eyebrow">Purpose</p>
            <h2>Emergency money should move quickly, without losing trust.</h2>
          </div>
          <div className="purpose-copy">
            <p>Bayanihan Fund gives barangays, associations, cooperatives, churches, and NGOs one shared treasury for disaster relief and medical emergencies.</p>
            <p>Contributions, requests, approvals, and payouts are recorded on-chain, replacing scattered cash records and spreadsheets with a process the whole community can verify.</p>
          </div>
        </div>
      </section>

      <section className="impact-band" aria-label="Community benefits">
        <div className="landing-container impact-grid">
          <div><strong>Faster response</strong><span>Approved aid reaches recipients when it is needed.</span></div>
          <div><strong>Shared accountability</strong><span>No single officer controls an emergency payout.</span></div>
          <div><strong>Visible records</strong><span>Members can trace how community funds are used.</span></div>
          <div><strong>Safer participation</strong><span>Wallets sign actions without exposing private keys.</span></div>
        </div>
      </section>

      <section className="wallet-purpose-section">
        <div className="landing-container wallet-purpose-layout">
          <div>
            <p className="landing-eyebrow light">Why a wallet?</p>
            <h2>A wallet is each member's secure identity.</h2>
            <p>It proves who contributed, who requested funds, and which officers approved a payout. The wallet signs the action while the private key stays with its owner.</p>
          </div>
          <div className="role-list">
            <div><span>01</span><strong>Residents</strong><p>Contribute USDC and verify community activity.</p></div>
            <div><span>02</span><strong>Treasurer</strong><p>Creates a documented withdrawal request.</p></div>
            <div><span>03</span><strong>Officers</strong><p>President and secretary independently approve it.</p></div>
            <div><span>04</span><strong>Recipient</strong><p>Receives funds after the required approvals.</p></div>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-container">
          <p className="landing-eyebrow">Pitch prototype</p>
          <h2>See the complete community fund flow.</h2>
          <p>Connect a Stellar wallet and confirm every action on Testnet. Testnet assets have no real-world value.</p>
          <button className="primary-button" onClick={onOpenMvp}>Open interactive MVP</button>
        </div>
      </section>
    </main>
  );
}
