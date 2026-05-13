"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

export default function NewPlayerPage() {
  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const [playerName, setPlayerName] = useState("");
  const [teamService, setTeamService] = useState("");
  const [nameError, setNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [globalError, setGlobalError] = useState("");

  const handleSubmit = async () => {
    setSuccessMessage("");
    setGlobalError("");
    setNameError("");

    const trimmedName = playerName.trim();
    const trimmedService = teamService.trim();

    if (!trimmedName) {
      setNameError("Le nom du joueur est obligatoire.");
      return;
    }

    if (trimmedName.length > 60) {
      setNameError("Le nom ne peut pas dépasser 60 caractères.");
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from("skyjo_players").insert({
        display_name: trimmedName,
        team_service: trimmedService || null,
        is_active: true,
      });

      if (error) {
        console.error("Erreur création joueur :", error);

        if (error.code === "23505") {
          setGlobalError("Ce joueur existe déjà.");
          return;
        }

        setGlobalError(
          "Impossible de créer le joueur. Vérifie les droits Supabase."
        );
        return;
      }

      setSuccessMessage("Le joueur a été créé avec succès.");
      setPlayerName("");
      setTeamService("");
    } catch (error) {
      console.error(error);
      setGlobalError("Une erreur est survenue pendant la création du joueur.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        Chargement...
      </main>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-emerald-500/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
            Nouveau joueur
          </p>

          <h1 className="mt-4 text-4xl font-semibold text-white">
            Ajouter un joueur
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Création manuelle dans la table skyjo_players. Le joueur sera créé
            automatiquement en statut actif et pourra être lié à un compte plus
            tard.
          </p>
        </section>

        <section className="max-w-2xl rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Formulaire
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-white">
                Informations joueur
              </h2>
            </div>

            <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-medium text-zinc-400">
              <span className="text-red-300">*</span> Champ obligatoire
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Nom du joueur
                <span className="text-red-300">*</span>
              </label>

              <input
                value={playerName}
                onChange={(event) => {
                  setPlayerName(event.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="Ex : Guillaume G"
                maxLength={60}
                className={`mt-2 h-12 w-full rounded-2xl border bg-black/25 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 ${
                  nameError
                    ? "border-red-400/40 focus:border-red-400/70"
                    : "border-white/10 focus:border-emerald-400/50"
                }`}
              />

              <div className="mt-2 flex items-center justify-between gap-4">
                <p className={`text-xs ${nameError ? "text-red-300" : "text-zinc-500"}`}>
                  {nameError ||
                    "Nom affiché dans les classements, rivalités et statistiques."}
                </p>

                <p className="shrink-0 text-xs text-zinc-600">
                  {playerName.length}/60
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Service / Team
              </label>

              <input
                value={teamService}
                onChange={(event) => setTeamService(event.target.value)}
                placeholder="Ex : Data / BI / Conseil..."
                maxLength={50}
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/50"
              />

              <div className="mt-2 flex items-center justify-between gap-4">
                <p className="text-xs text-zinc-500">
                  Champ facultatif utilisé pour les futurs filtres et analytics.
                </p>

                <p className="shrink-0 text-xs text-zinc-600">
                  {teamService.length}/50
                </p>
              </div>
            </div>

            {globalError && (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {globalError}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {successMessage}
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Création..." : "Créer le joueur"}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}