"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import FormMessage from "@/components/FormMessage";
import PasswordInput from "@/components/PasswordInput";
import AuthLayout from "@/components/auth/AuthLayout";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function LoginPage() {
  const { checkingAuth } = useAuthRedirect({
    redirectIfAuthenticated: true,
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "info">(
    "info"
  );
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (value: string) => {
    setEmail(value);

    const cleanEmail = value.toLowerCase().trim();

    if (!cleanEmail) {
      setEmailError("");
      return;
    }

    if (!cleanEmail.endsWith("@seenovate.com")) {
      setEmailError("Email Seenovate requis.");
      return;
    }

    setEmailError("");
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);

    if (!value) {
      setPasswordError("Mot de passe requis.");
      return;
    }

    setPasswordError("");
  };

  const handleLogin = async () => {
    setMessage("");

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      setMessageType("error");
      setMessage("Merci de renseigner ton email.");
      return;
    }

    if (!cleanEmail.endsWith("@seenovate.com")) {
      setMessageType("error");
      setMessage("Seuls les emails @seenovate.com sont autorisés.");
      return;
    }

    if (!password) {
      setMessageType("error");
      setMessage("Merci de renseigner ton mot de passe.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setMessageType("error");
      setMessage(getAuthErrorMessage(error));
      setLoading(false);
      return;
    }

    if (!data.user?.email_confirmed_at) {
      setMessageType("error");
      setMessage("Ton compte n’est pas encore confirmé. Vérifie ton email.");
      setLoading(false);
      return;
    }

    setMessageType("success");
    setMessage("Connexion réussie. Redirection vers le dashboard...");

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 600);
  };

  if (checkingAuth) {
    return null;
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accède au classement interne, aux statistiques et aux performances de la ligue Skyjo."
    >
      <div className="space-y-4">
        {message && <FormMessage type={messageType} message={message} />}

        <div className="space-y-1.5">
          <input
            type="email"
            placeholder="prenom.nom@seenovate.com"
            className={`w-full rounded-xl border bg-white/[0.07] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:bg-white/[0.1] ${
              emailError
                ? "border-red-400/70 focus:border-red-400"
                : "border-white/10 focus:border-blue-400"
            }`}
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
          />

          {emailError && <p className="text-xs text-red-400">{emailError}</p>}
        </div>

        <div className="space-y-1.5">
          <PasswordInput
            value={password}
            onChange={handlePasswordChange}
            placeholder="Mot de passe"
          />

          {passwordError && (
            <p className="text-xs text-red-400">{passwordError}</p>
          )}
        </div>

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-zinc-400 transition hover:text-blue-300"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !!emailError || !!passwordError}
          className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-400">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium text-blue-300 hover:text-blue-200"
        >
          Créer un compte
        </Link>
      </p>
    </AuthLayout>
  );
}