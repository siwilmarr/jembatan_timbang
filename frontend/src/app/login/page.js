"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Login from "../../components/Login";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("user_token");
      if (token) {
        router.push("/");
      }
    }
  }, [router]);

  const handleLoginSuccess = (newToken, userData) => {
    router.push("/");
  };

  return <Login onLoginSuccess={handleLoginSuccess} />;
}
