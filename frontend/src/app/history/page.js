"use client";

import { useEffect, useState } from "react";
import HistoryDashboard from "../../components/HistoryDashboard";
import PageWrapper from "../../components/PageWrapper";

export default function HistoryPage() {
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
      <HistoryDashboard
        userRole={user?.roles}
        userWarehouse={{ id: user?.warehouse_id, name: user?.warehouse_name }}
      />
    </PageWrapper>
  );
}
