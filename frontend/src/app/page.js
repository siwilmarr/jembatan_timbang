"use client";

import { useEffect, useState } from "react";
import Dashboard from "../components/Dashboard";
import PageWrapper from "../components/PageWrapper";

export default function HomePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("user_info") || "null");
      setUser(savedUser);
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <PageWrapper>
      <Dashboard
        userRole={user?.roles}
        operatorUsername={user?.username}
        userWarehouse={{ id: user?.warehouse_id, name: user?.warehouse_name }}
      />
    </PageWrapper>
  );
}
