"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import FormMessage from "@/components/FormMessage";
import PasswordInput, { isPasswordStrong } from "@/components/PasswordInput";
import AuthLayout from "@/components/auth/AuthLayout";
import { getAuthErrorMessage } from "@/lib/authErrors";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "info">(
    "info"
  );
  const [loading, setLoading] = useState(false);

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

    if (confirmPassword && value !== confirmPassword) {
      setConfirmPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    setConfirmPasswordError("");
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);

    if (!value) {
      setConfirmPasswordError("");
      return;
    }

    if (password !== value) {
      setConfirmPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    setConfirmPasswordError("");
  };

  const handleUpdatePassword = async () => {
    setMessage("");

    if (!isPasswordStrong(password)) {
      setMessageType("error");
      setMessage(
        "Le nouveau mot de passe ne respecte pas toutes les règles de sécurité."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessageType("error");
      setMessage("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessageType("error");
      setMessage(getAuthErrorMessage(error));
      setLoading(false);
      return;
    }

    setMessageType("success");
    setMessage("Mot de passe mis à jour. Redirection vers la connexion...");

    setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = "/login";
    }, 1200);
  };

  const canSubmit =
    !loading &&
    isPasswordStrong(password) &&
    confirmPassword.length > 0 &&
    password === confirmPassword &&
    !passwordError &&
    !confirmPasswordError;

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Définis un nouveau mot de passe sécurisé pour accéder de nouveau à ton compte Skyjo."
    >
      <div className="space-y-4">
        {message && <FormMessage type={messageType} message={message} />}

        <div className="space-y-1.5">
          <PasswordInput
            value={password}
            onChange={handlePasswordChange}
            placeholder="Nouveau mot de passe"
            showStrength
          />

          {passwordError && (
            <p className="text-xs text-red-400">{passwordError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <PasswordInput
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            placeholder="Confirmer le mot de passe"
          />

          {confirmPasswordError && (
            <p className="text-xs text-red-400">{confirmPasswordError}</p>
          )}

          {confirmPassword.length > 0 && !confirmPasswordError && (
            <p className="text-xs text-emerald-300">
              Les mots de passe correspondent.
            </p>
          )}
        </div>

        <button
          onClick={handleUpdatePassword}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Mise à jour..." : "Modifier le mot de passe"}
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