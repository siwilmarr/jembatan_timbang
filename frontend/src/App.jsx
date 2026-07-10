import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import { startAutoSync } from "./services/syncService";

export default function App() {
  useEffect(() => {
    const stopSync = startAutoSync();
    return stopSync;
  }, []);

  return <Dashboard />;
}