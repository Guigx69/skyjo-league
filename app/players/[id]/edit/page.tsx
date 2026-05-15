"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

type PlayerRow = {
  id: string;
  joueur_id?: string | null;
  display_name: string | null;
  team_service: string | null;
  is_active: boolean | null;
};

export default function EditPlayerPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });

  const params = useParams();
  const router = useRouter();
  const playerRouteId = String(params.id ?? "");

  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [teamService, setTeamService] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [nameError, setNameError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (checkingAuth || !playerRouteId) return;

    async function loadPage() {
      try {
        setCheckingRole(true);
        setLoading(true);
        setGlobalError("");
        setSuccessMessage("");

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.email) {
          router.push("/login");
          return;
        }

        const { data: adminResult, error: adminError } = await supabase.rpc(
          "is_current_user_admin"
        );

        if (adminError || adminResult !== true) {
          setIsAdmin(false);
          setGlobalError(
            "Accès refusé. Seul un administrateur peut modifier un joueur."
          );
          return;
        }

        setIsAdmin(true);

        const { data: playersData, error: playersError } = await supabase
          .from("skyjo_players")
          .select("id, joueur_id, display_name, team_service, is_active")
          .order("display_name", { ascending: true });

        if (playersError) {
          console.error("Erreur chargement joueurs :", playersError);
          setGlobalError(
            `Impossible de charger les joueurs : ${playersError.message}`
          );
          return;
        }

        const players = (playersData ?? []) as PlayerRow[];

        let loadedPlayer =
          players.find((item) => String(item.id) === playerRouteId) ?? null;

        if (!loadedPlayer) {
          loadedPlayer =
            players.find((item) => String(item.joueur_id ?? "") === playerRouteId) ??
            null;
        }

        if (!loadedPlayer && /^\d+$/.test(playerRouteId)) {
          const legacyIndex = Number(playerRouteId) - 1;
          loadedPlayer = players[legacyIndex] ?? null;
        }

        if (!loadedPlayer) {
          console.error("Joueur introuvable avec route id :", {
            playerRouteId,
            availableIds: players.map((item) => ({
              id: item.id,
              joueur_id: item.joueur_id,
              display_name: item.display_name,
            })),
          });

          setGlobalError("Joueur introuvable dans skyjo_players.");
          return;
        }

        setPlayer(loadedPlayer);
        setPlayerName(loadedPlayer.display_name ?? "");
        setTeamService(loadedPlayer.team_service ?? "");
        setIsActive(loadedPlayer.is_active !== false);
      } catch (error) {
        console.error("Erreur inattendue chargement joueur :", error);
        setGlobalError("Une erreur inattendue est survenue.");
      } finally {
        setCheckingRole(false);
        setLoading(false);
      }
    }

    loadPage();
  }, [checkingAuth, playerRouteId, router]);

  async function handleSubmit() {
    setSuccessMessage("");
    setGlobalError("");
    setNameError("");

    const trimmedName = playerName.trim();
    const trimmedService = teamService.trim();

    if (!player) {
      setGlobalError("Joueur introuvable.");
      return;
    }

    if (!trimmedName) {
      setNameError("Le nom du joueur est obligatoire.");
      return;
    }

    if (trimmedName.length > 60) {
      setNameError("Le nom ne peut pas dépasser 60 caractères.");
      return;
    }

    if (trimmedService.length > 50) {
      setGlobalError("Le service / team ne peut pas dépasser 50 caractères.");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("skyjo_players")
        .update({
          display_name: trimmedName,
          team_service: trimmedService || null,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", player.id);

      if (error) {
        console.error("Erreur modification joueur :", error);

        if (error.code === "23505") {
          setGlobalError("Un joueur avec ce nom existe déjà.");
          return;
        }

        setGlobalError(`Impossible de modifier le joueur : ${error.message}`);
        return;
      }

      const updatedPlayer: PlayerRow = {
        ...player,
        display_name: trimmedName,
        team_service: trimmedService || null,
        is_active: isActive,
      };

      setPlayer(updatedPlayer);
      setSuccessMessage("Le joueur a été modifié avec succès.");

      router.refresh();
    } catch (error) {
      console.error("Erreur inattendue modification joueur :", error);
      setGlobalError("Une erreur est survenue pendant la modification du joueur.");
    } finally {
      setSaving(false);
    }
  }

  if (checkingAuth || checkingRole || loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-zinc-400">
          Chargement du joueur...
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-red-400/20 bg-red-400/10 p-6 text-red-100">
          {globalError}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
            Modification joueur
          </p>

          <h1 className="mt-4 text-4xl font-semibold text-white">
            Modifier un joueur
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Mise à jour manuelle dans la table skyjo_players. Les statistiques
            historiques restent rattachées au même identifiant joueur.
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

            <div
              className={`rounded-full border px-4 py-2 text-xs font-medium ${
                isActive
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-200"
              }`}
            >
              {isActive ? "Actif" : "Inactif"}
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
                    : "border-white/10 focus:border-blue-400/50"
                }`}
              />

              <div className="mt-2 flex items-center justify-between gap-4">
                <p
                  className={`text-xs ${
                    nameError ? "text-red-300" : "text-zinc-500"
                  }`}
                >
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
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/50"
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

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Statut joueur
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Un joueur inactif reste dans l’historique, mais peut être
                    masqué des futures sélections.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsActive((current) => !current)}
                  className={`relative h-10 w-20 shrink-0 cursor-pointer rounded-full border transition ${
                    isActive
                      ? "border-emerald-300/40 bg-emerald-300/20"
                      : "border-white/10 bg-white/[0.05]"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-8 w-8 rounded-full transition ${
                      isActive ? "left-11 bg-emerald-300" : "left-1 bg-zinc-500"
                    }`}
                  />
                </button>
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

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => router.push("/players")}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white hover:text-slate-950"
              >
                Retour aux joueurs
              </button>

              <button
                type="button"
                disabled={saving || !player}
                onClick={handleSubmit}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}