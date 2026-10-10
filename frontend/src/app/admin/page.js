"use client";

import { useEffect, useState } from "react";
import AdminPanel from "../../components/AdminPanel";
import PageWrapper from "../../components/PageWrapper";

export default function AdminPage() {
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    try {
      setUserRole(JSON.parse(localStorage.getItem("user_info") || "{}")?.roles || []);
    } catch {
      setUserRole([]);
    }
  }, []);

  if (userRole === null) return null;

  return (
    <PageWrapper>
      <AdminPanel userRole={userRole} />
    </PageWrapper>
  );
}
