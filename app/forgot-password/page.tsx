"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import FormMessage from "@/components/FormMessage";
import AuthLayout from "@/components/auth/AuthLayout";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function ForgotPasswordPage() {
  const { checkingAuth } = useAuthRedirect({
    redirectIfAuthenticated: true,
  });

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

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

  const handleResetPassword = async () => {
    setMessage("");

    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail) {
      setMessageType("error");
      setMessage("Merci de renseigner ton email.");
      return;
    }

    if (!cleanEmail.endsWith("@seenovate.com")) {
      setMessageType("error");
      setMessage("Seules les adresses @seenovate.com sont autorisées.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: "http://localhost:3000/update-password",
    });

    if (error) {
      setMessageType("error");
      setMessage(getAuthErrorMessage(error));
      setLoading(false);
      return;
    }

    setMessageType("success");
    setMessage(
      "Email envoyé. Consulte ta boîte mail pour réinitialiser ton mot de passe."
    );
    setLoading(false);
  };

  if (checkingAuth) {
    return null;
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Renseigne ton email Seenovate pour recevoir un lien de réinitialisation sécurisé."
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

        <button
          onClick={handleResetPassword}
          disabled={loading || !!emailError}
          className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Envoi en cours..." : "Envoyer le lien"}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-400">
        Retour à la{" "}
        <Link
          href="/login"
          className="font-medium text-blue-300 hover:text-blue-200"
        >
          connexion
        </Link>
      </p>
    </AuthLayout>
  );
}