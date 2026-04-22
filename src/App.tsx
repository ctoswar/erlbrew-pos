import React, { useState } from "react";
import { Staff } from "./types";
import { LoginScreen } from "./components/LoginScreen";
import { POSScreen } from "./components/POSScreen";
import "./styles/global.css";

const App: React.FC = () => {
  const [staff, setStaff] = useState<Staff | null>(null);

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
