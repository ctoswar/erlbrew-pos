import React, { useState } from "react";
import { Staff } from "./types";
import { LoginScreen } from "./components/LoginScreen";
import { POSScreen } from "./components/POSScreen";
import { CustomerDisplay } from "./components/CustomerDisplay";
import "./styles/global.css";

const App: React.FC = () => {
  const [staff, setStaff] = useState<Staff | null>(null);

  // ?customer → fullscreen customer-facing display (second monitor)
  if (window.location.search.includes("customer")) {
    return <CustomerDisplay />;
  }

  if (!staff) {
    return <LoginScreen onLogin={setStaff} />;
  }

  return (
    <POSScreen
      staff={staff}
      onLogout={() => setStaff(null)}
    />
  );
};

export default App;
