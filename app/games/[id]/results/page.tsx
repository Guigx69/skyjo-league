"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

type GameRow = {
  id: string;
  partie_id: string;
  played_at: string;
  location: string | null;
  expected_players_count: number | null;
};

type PlayerRow = {
  id: string;
  joueur_id: string;
  display_name: string;
  team_service: string | null;
  is_active: boolean;
};

type ResultLine = {
  playerId: string;
  score: string;
};

export default function GameResultsPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });
  const params = useParams();
  const router = useRouter();

  const gameId = String(params.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [lines, setLines] = useState<ResultLine[]>([]);

  const [globalError, setGlobalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!checkingAuth && gameId) {
      loadPageData();
    }
  }, [checkingAuth, gameId]);

  const expectedCount = game?.expected_players_count ?? 0;

  const selectedPlayerIds = useMemo(() => {
    return lines.map((line) => line.playerId).filter(Boolean);
  }, [lines]);

  const selectedPlayersCount = selectedPlayerIds.length;

  const positions = useMemo(() => {
    return computePositions(lines);
  }, [lines]);

  const loadPageData = async () => {
    setLoading(true);
    setGlobalError("");

    try {
      const { data: gameData, error: gameError } = await supabase
        .from("skyjo_games")
        .select("id, partie_id, played_at, location, expected_players_count")
        .eq("id", gameId)
        .single();

      if (gameError || !gameData) {
        console.error(gameError);
        setGlobalError("Partie introuvable.");
        return;
      }

      const { data: existingResults, error: existingResultsError } =
        await supabase
          .from("skyjo_game_results")
          .select("id")
          .eq("game_id", gameId)
          .limit(1);

      if (existingResultsError) {
        console.error(existingResultsError);
        setGlobalError("Impossible de vérifier les résultats existants.");
        return;
      }

      if ((existingResults ?? []).length > 0) {
        setGlobalError("Des résultats existent déjà pour cette partie.");
      }

      const { data: playersData, error: playersError } = await supabase
        .from("skyjo_players")
        .select("id, joueur_id, display_name, team_service, is_active")
        .eq("is_active", true)
        .order("display_name", { ascending: true });

      if (playersError) {
        console.error(playersError);
        setGlobalError("Impossible de charger les joueurs actifs.");
        return;
      }

      const count = gameData.expected_players_count ?? 0;

      setGame(gameData as GameRow);
      setPlayers((playersData ?? []) as PlayerRow[]);
      setLines(
        Array.from({ length: count }, () => ({
          playerId: "",
          score: "",
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const updateLine = (
    index: number,
    field: keyof ResultLine,
    value: string
  ) => {
    setSuccessMessage("");
    setGlobalError("");

    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      )
    );
  };

  const validateLines = () => {
    if (!game) return "Partie introuvable.";

    if (!expectedCount || expectedCount < 2) {
      return "Le nombre de joueurs attendu est invalide.";
    }

    if (lines.length !== expectedCount) {
      return `La partie attend ${expectedCount} joueur(s).`;
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const score = Number(line.score);

      if (!line.playerId) {
        return `Le joueur de la ligne ${index + 1} est obligatoire.`;
      }

      if (line.score.trim() === "") {
        return `Le score de la ligne ${index + 1} est obligatoire.`;
      }

      if (!Number.isInteger(score)) {
        return `Le score de la ligne ${index + 1} doit être un nombre entier.`;
      }
    }

    const uniquePlayers = new Set(lines.map((line) => line.playerId));

    if (uniquePlayers.size !== lines.length) {
      return "Un même joueur ne peut pas être saisi deux fois.";
    }

    return "";
  };

  const saveResults = async () => {
    setGlobalError("");
    setSuccessMessage("");

    const validationError = validateLines();

    if (validationError) {
      setGlobalError(validationError);
      return;
    }

    if (!game) {
      setGlobalError("Partie introuvable.");
      return;
    }

    try {
      setSaving(true);

      const { data: userData } = await supabase.auth.getUser();

      const resultPayload = lines.map((line, index) => {
        const position = positions.get(index) ?? index + 1;

        return {
          resultat_id: `${game.partie_id}-R${String(index + 1).padStart(2, "0")}`,
          game_id: game.id,
          player_id: line.playerId,
          score: Number(line.score),
          position,
          source_created_at: new Date().toISOString(),
          source_created_by: userData.user?.email ?? "web",
        };
      });

      const { error } = await supabase
        .from("skyjo_game_results")
        .insert(resultPayload);

      if (error) {
        console.error(error);

        if (error.code === "23505") {
          setGlobalError("Des résultats existent déjà pour cette partie.");
          return;
        }

        if (error.code === "23503") {
          setGlobalError("Un joueur ou une partie référencée est introuvable.");
          return;
        }

        if (error.code === "23502") {
          setGlobalError("Un champ obligatoire est manquant.");
          return;
        }

        if (error.code === "42501") {
          setGlobalError("Droits insuffisants pour enregistrer les résultats.");
          return;
        }

        setGlobalError(
          `${error.code ?? ""} - ${error.message ?? "Erreur Supabase"}${
            error.details ? ` - ${error.details}` : ""
          }`
        );
        return;
      }

      setSuccessMessage("Résultats enregistrés avec succès.");

      window.setTimeout(() => {
        router.push("/games");
      }, 1200);
    } catch (error) {
      console.error(error);
      setGlobalError("Erreur pendant l’enregistrement des résultats.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        Chargement...
      </main>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-emerald-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
            Résultats
          </p>

          <h1 className="mt-4 text-4xl font-semibold text-white">
            Saisir les résultats
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Partie {game?.partie_id} · {formatDate(game?.played_at)} ·{" "}
            {game?.location ?? "Lieu non renseigné"}
          </p>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Saisie
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-white">
                Joueurs et scores
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                {selectedPlayersCount}/{expectedCount} joueur(s) sélectionné(s).
              </p>

              <p className="mt-2 text-xs leading-5 text-zinc-500">
                <span className="text-red-300">*</span> champ obligatoire · La
                position est calculée automatiquement : le score le plus bas est
                classé #1.
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-medium text-zinc-400">
              <span className="text-red-300">*</span> Champs obligatoires
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {lines.map((line, index) => {
              const computedPosition = positions.get(index);

              return (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1.5fr_0.7fr_0.7fr]"
                >
                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Joueur
                      <span className="text-red-300">*</span>
                    </label>

                    <select
                      value={line.playerId}
                      onChange={(event) =>
                        updateLine(index, "playerId", event.target.value)
                      }
                      className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#020617] px-4 text-sm font-semibold text-white outline-none focus:border-emerald-400/50"
                    >
                      <option value="">Sélectionner un joueur</option>

                      {players.map((player) => {
                        const alreadySelected =
                          selectedPlayerIds.includes(player.id) &&
                          line.playerId !== player.id;

                        return (
                          <option
                            key={player.id}
                            value={player.id}
                            disabled={alreadySelected}
                          >
                            {player.display_name}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Score
                      <span className="text-red-300">*</span>
                    </label>

                    <input
                      type="number"
                      value={line.score}
                      onChange={(event) =>
                        updateLine(index, "score", event.target.value)
                      }
                      placeholder="Ex : 28"
                      className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-[#020617] px-4 text-sm font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-emerald-400/50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Position auto
                    </label>

                    <div className="mt-2 flex h-12 items-center rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-emerald-200">
                      {computedPosition ? `#${computedPosition}` : "—"}
                    </div>

                    <p className="mt-2 text-xs text-zinc-500">
                      Calculée depuis le score.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {globalError && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              {globalError}
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {successMessage}
            </div>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={saveResults}
            className="mt-6 w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Enregistrer les résultats"}
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function formatDate(value?: string) {
  if (!value) return "Date inconnue";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function computePositions(lines: ResultLine[]) {
  const scoredLines = lines
    .map((line, index) => ({
      index,
      score: Number(line.score),
    }))
    .filter((line) => Number.isFinite(line.score));

  scoredLines.sort((a, b) => a.score - b.score);

  const positions = new Map<number, number>();
  let currentPosition = 1;

  scoredLines.forEach((line, index) => {
    if (index > 0 && line.score !== scoredLines[index - 1].score) {
      currentPosition = index + 1;
    }

    positions.set(line.index, currentPosition);
  });

  return positions;
}