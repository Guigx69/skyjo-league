"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import FormMessage from "@/components/FormMessage";
import PasswordInput, { isPasswordStrong } from "@/components/PasswordInput";
import AuthLayout from "@/components/auth/AuthLayout";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function RegisterPage() {
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
      setPasswordError("");
      return;
    }

    if (!isPasswordStrong(value)) {
      setPasswordError("Mot de passe incomplet.");
      return;
    }

    setPasswordError("");
  };

  const handleRegister = async () => {
    setMessage("");

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      setMessageType("error");
      setMessage("Merci de renseigner ton email.");
      return;
    }

    if (!cleanEmail.endsWith("@seenovate.com")) {
      setMessageType("error");
      setMessage("Inscription réservée aux adresses @seenovate.com.");
      return;
    }

    if (!isPasswordStrong(password)) {
      setMessageType("error");
      setMessage(
        "Le mot de passe ne respecte pas encore toutes les règles de sécurité."
      );
      return;
    }

    setLoading(true);

    const { data: emailExists, error: rpcError } = await supabase.rpc(
      "check_profile_email_exists",
      {
        input_email: cleanEmail,
      }
    );

    if (rpcError) {
      setMessageType("error");
      setMessage("Impossible de vérifier l’existence du compte.");
      setLoading(false);
      return;
    }

    if (emailExists) {
      setMessageType("error");
      setMessage("Un compte existe déjà avec cet email. Connecte-toi.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (error) {
      setMessageType("error");
      setMessage(getAuthErrorMessage(error));
      setLoading(false);
      return;
    }

    setMessageType("success");
    setMessage("Compte créé. Vérifie ton email pour confirmer ton inscription.");

    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  };

  if (checkingAuth) {
    return null;
  }

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Inscription réservée aux collaborateurs Seenovate pour rejoindre la ligue Skyjo."
    >
      <div className="space-y-4">
        {message && (
          <>
            <FormMessage type={messageType} message={message} />

            {messageType === "error" &&
              message.toLowerCase().includes("existe") && (
                <button
                  onClick={() => (window.location.href = "/login")}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white hover:text-slate-950"
                >
                  Aller à la connexion
                </button>
              )}
          </>
        )}

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
            showStrength
          />

          {passwordError && (
            <p className="text-xs text-red-400">{passwordError}</p>
          )}
        </div>

        <button
          onClick={handleRegister}
          disabled={loading || !!emailError || !!passwordError}
          className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Création du compte..." : "S’inscrire"}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-400">
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-medium text-blue-300 hover:text-blue-200"
        >
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}