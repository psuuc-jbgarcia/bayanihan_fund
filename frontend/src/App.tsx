import { useState } from "react";
import { FundDashboard } from "./components/FundDashboard";
import { LandingPage } from "./components/LandingPage";

export default function App() {
  const [showMvp, setShowMvp] = useState(false);
  return showMvp
    ? <FundDashboard onExit={() => setShowMvp(false)} />
    : <LandingPage onOpenMvp={() => setShowMvp(true)} />;
}
