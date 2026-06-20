import { StellarWalletPanel } from "./components/StellarWalletPanel";

export default function App() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Bayanihan Fund home">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>Bayanihan Fund</span>
        </a>
        <span className="network-pill"><span className="status-dot" aria-hidden="true" />Stellar Testnet</span>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Community treasury · Level 1</p>
          <h1>Move testnet funds<br />with confidence.</h1>
          <p className="hero-copy">Connect your Freighter wallet, check your XLM balance, and send a test payment through Stellar’s public test network.</p>
        </div>
        <aside className="trust-note">
          <span aria-hidden="true">✦</span>
          <p><strong>Your keys stay yours.</strong> Freighter signs every transaction; this app never sees your secret key.</p>
        </aside>
      </section>

      <StellarWalletPanel />

      <footer>
        <span>Bayanihan means helping one another.</span>
        <span>Testnet assets have no real-world value.</span>
      </footer>
    </main>
  );
}

