"use client";

import AdminPanel from "../../components/AdminPanel";
import PageWrapper from "../../components/PageWrapper";

export default function AdminPage() {
  return (
    <PageWrapper requireAdmin={true}>
      <AdminPanel />
    </PageWrapper>
  );
}
