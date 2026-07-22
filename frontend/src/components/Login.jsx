import { useState } from "react";

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        if (res.status === 400) {
          throw new Error("Username atau password salah.");
        }
        throw new Error("Gagal terhubung ke server backend.");
      }

      const data = await res.json();
      // Simpan credentials ke localStorage
      localStorage.setItem("user_token", data.token);
      localStorage.setItem("user_info", JSON.stringify({
        username: data.username,
        roles: data.roles,
        user_id: data.user_id,
      }));

      // Trigger callback sukses
      onLoginSuccess(data.token, data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-card__header">
          <h2>Jembatan Timbang</h2>
          <p>Silakan masuk untuk melanjutkan operasional</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-form__error">{error}</div>}

          <label className="login-form__label">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              required
              disabled={loading}
            />
          </label>

          <label className="login-form__label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              required
              disabled={loading}
            />
          </label>

          <button type="submit" disabled={loading} className="login-form__submit">
            {loading ? "Menghubungkan..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
