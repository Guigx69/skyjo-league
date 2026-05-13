"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, Trash2, UserPlus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

type Player = {
  id: string;
  display_name: string;
  is_active: boolean;
};

type Game = {
  id: string;
  partie_id: string;
  played_at: string;
  location: string | null;
  expected_players_count: number | null;
};

type EditableResult = {
  id: string;
  resultat_id: string;
  player_id: string;
  player_name: string;
  score: string;
  position: number | null;
  is_winner: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
};

export default function EditGamePage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });

  const params = useParams();
  const router = useRouter();
  const gameId = String(params.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<EditableResult[]>([]);

  const [playedAt, setPlayedAt] = useState("");
  const [location, setLocation] = useState("");

  const [openPlayerSelectId, setOpenPlayerSelectId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeResults = useMemo(
    () => results.filter((result) => !result.isDeleted),
    [results]
  );

  const recalculatedResults = useMemo(() => {
    const validResults = activeResults.filter((result) => {
      const score = Number(result.score);
      return result.score.trim() !== "" && Number.isFinite(score);
    });

    const invalidResults = activeResults.filter((result) => {
      const score = Number(result.score);
      return result.score.trim() === "" || !Number.isFinite(score);
    });

    const sortedValidResults = [...validResults].sort(
      (a, b) => Number(a.score) - Number(b.score)
    );

    const winningScore =
      sortedValidResults.length > 0 ? Number(sortedValidResults[0].score) : null;

    return [
      ...sortedValidResults.map((result, index) => ({
        ...result,
        position: index + 1,
        is_winner:
          winningScore !== null && Number(result.score) === winningScore,
      })),
      ...invalidResults.map((result) => ({
        ...result,
        position: null,
        is_winner: false,
      })),
    ];
  }, [activeResults]);

  const winner = recalculatedResults.find((result) => result.is_winner);

  const selectedPlayerIds = useMemo(
    () => activeResults.map((result) => result.player_id).filter(Boolean),
    [activeResults]
  );

  useEffect(() => {
    if (checkingAuth || !gameId) return;

    async function loadPageData() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const authEmail = String(user.email ?? "").toLowerCase().trim();

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, email")
          .eq("user_id", user.id)
          .maybeSingle();

        const profileRole = String(profile?.role ?? "").toLowerCase().trim();
        const profileEmail = String(profile?.email ?? "").toLowerCase().trim();

        const canEdit =
          !profileError &&
          (profileRole === "admin" ||
            authEmail.includes("+admin@") ||
            profileEmail.includes("+admin@"));

        if (!canEdit) {
          setIsAdmin(false);
          setError("Accès refusé. Seul un administrateur peut modifier une partie.");
          return;
        }

        setIsAdmin(true);

        const { data: gameData, error: gameError } = await supabase
          .from("skyjo_games")
          .select("id, partie_id, played_at, location, expected_players_count")
          .eq("partie_id", gameId)
          .maybeSingle();

        if (gameError || !gameData) {
          setError("Partie introuvable.");
          return;
        }

        setGame(gameData);
        setPlayedAt(gameData.played_at ?? "");
        setLocation(gameData.location ?? "");

        const { data: playersData, error: playersError } = await supabase
          .from("skyjo_players")
          .select("id, display_name, is_active")
          .order("display_name", { ascending: true });

        if (playersError) {
          setError("Impossible de charger les joueurs.");
          return;
        }

        setPlayers(playersData ?? []);

        const { data: resultsData, error: resultsError } = await supabase
          .from("skyjo_game_results")
          .select(
            `
            id,
            resultat_id,
            game_id,
            player_id,
            score,
            position,
            is_winner,
            skyjo_players (
              display_name
            )
          `
          )
          .eq("game_id", gameData.id);

        if (resultsError) {
          setError("Impossible de charger les résultats de la partie.");
          return;
        }

        const mappedResults: EditableResult[] = (resultsData ?? []).map(
          (result: any) => ({
            id: result.id,
            resultat_id: result.resultat_id,
            player_id: result.player_id,
            player_name: result.skyjo_players?.display_name ?? "Joueur inconnu",
            score: String(result.score ?? ""),
            position: result.position ?? null,
            is_winner: Boolean(result.is_winner),
          })
        );

        setResults(mappedResults);
      } catch {
        setError("Une erreur inattendue est survenue.");
      } finally {
        setLoading(false);
      }
    }

    loadPageData();
  }, [checkingAuth, gameId, router]);

  function formatDateForDisplay(value: string) {
    if (!value) return "Sélectionner une date";

    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;

    return `${day}/${month}/${year}`;
  }

  function buildDateOptions() {
    const today = new Date();
    const options: { label: string; value: string }[] = [];

    for (let offset = -15; offset <= 15; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);

      const value = date.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);

      options.push({
        label: label.replace(".", ""),
        value,
      });
    }

    if (playedAt && !options.some((option) => option.value === playedAt)) {
      options.unshift({
        label: formatDateForDisplay(playedAt),
        value: playedAt,
      });
    }

    return options;
  }

  function updateResultScore(resultId: string, value: string) {
    setResults((current) =>
      current.map((result) =>
        result.id === resultId ? { ...result, score: value } : result
      )
    );
  }

  function updateResultPlayer(resultId: string, playerId: string) {
    const player = players.find((item) => item.id === playerId);

    setResults((current) =>
      current.map((result) =>
        result.id === resultId
          ? {
              ...result,
              player_id: playerId,
              player_name: player?.display_name ?? "Joueur inconnu",
            }
          : result
      )
    );

    setOpenPlayerSelectId(null);
  }

  function addResultRow() {
    setError(null);

    const availablePlayer = players.find(
      (player) =>
        player.is_active &&
        !activeResults.some((result) => result.player_id === player.id)
    );

    if (!availablePlayer) {
      setError("Aucun joueur actif disponible à ajouter.");
      return;
    }

    const temporaryId = `new-${crypto.randomUUID()}`;

    setResults((current) => [
      ...current,
      {
        id: temporaryId,
        resultat_id: temporaryId,
        player_id: availablePlayer.id,
        player_name: availablePlayer.display_name,
        score: "",
        position: null,
        is_winner: false,
        isNew: true,
      },
    ]);
  }

  function removeResultRow(resultId: string) {
    setResults((current) =>
      current
        .map((result) => {
          if (result.id !== resultId) return result;
          if (result.isNew) return null;
          return { ...result, isDeleted: true };
        })
        .filter(Boolean) as EditableResult[]
    );
  }

  function validateBeforeSave() {
    if (!game) return "Partie introuvable.";
    if (!playedAt) return "La date de la partie est obligatoire.";
    if (activeResults.length === 0) return "La partie doit contenir au moins un joueur.";

    const duplicatedPlayer = activeResults.find((result, index) =>
      activeResults.some(
        (otherResult, otherIndex) =>
          otherIndex !== index && otherResult.player_id === result.player_id
      )
    );

    if (duplicatedPlayer) {
      return `Le joueur ${duplicatedPlayer.player_name} est présent plusieurs fois dans la partie.`;
    }

    for (const result of activeResults) {
      if (!result.player_id) return "Chaque ligne doit avoir un joueur.";

      if (result.score.trim() === "") {
        return `Le score de ${result.player_name} est obligatoire.`;
      }

      if (!Number.isFinite(Number(result.score))) {
        return `Le score de ${result.player_name} doit être un nombre.`;
      }
    }

    return null;
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const validationError = validateBeforeSave();

      if (validationError) {
        setError(validationError);
        return;
      }

      if (!game) return;

      const now = new Date().toISOString();

      const { error: gameUpdateError } = await supabase
        .from("skyjo_games")
        .update({
          played_at: playedAt,
          location: location.trim() || null,
          expected_players_count: activeResults.length,
          updated_at: now,
        })
        .eq("id", game.id);

      if (gameUpdateError) {
        console.error("Erreur update partie :", gameUpdateError);
        setError(`Impossible de mettre à jour la partie : ${gameUpdateError.message}`);
        return;
      }

      const deletedResults = results.filter(
        (result) => result.isDeleted && !result.isNew
      );

      if (deletedResults.length > 0) {
        const { error: deleteError } = await supabase
          .from("skyjo_game_results")
          .delete()
          .in(
            "id",
            deletedResults.map((result) => result.id)
          );

        if (deleteError) {
          console.error("Erreur delete résultats :", deleteError);
          setError(`Impossible de supprimer certains résultats : ${deleteError.message}`);
          return;
        }
      }

      const existingResults = recalculatedResults.filter((result) => !result.isNew);

      const updateResponses = await Promise.all(
        existingResults.map((result) =>
          supabase
            .from("skyjo_game_results")
            .update({
                player_id: result.player_id,
                score: Number(result.score),
                position: result.position,
                updated_at: now,
            })
            .eq("id", result.id)
        )
      );

      const updateError = updateResponses.find((response) => response.error)?.error;

      if (updateError) {
        console.error("Erreur update résultats :", updateError);
        setError(`Impossible de modifier certains résultats : ${updateError.message}`);
        return;
      }

      const newResults = recalculatedResults.filter((result) => result.isNew);

      if (newResults.length > 0) {
        const { error: insertError } = await supabase
          .from("skyjo_game_results")
          .insert(
            newResults.map((result) => ({
                resultat_id: `${game.partie_id}-${result.player_id}`,
                game_id: game.id,
                player_id: result.player_id,
                score: Number(result.score),
                position: result.position,
                created_at: now,
                updated_at: now,
            }))
          );

        if (insertError) {
          console.error("Erreur insert résultats :", insertError);
          setError(`Impossible d'ajouter certains résultats : ${insertError.message}`);
          return;
        }
      }

      setSuccess("Partie modifiée avec succès.");
      router.push(`/games/${game.partie_id}`);
      router.refresh();
    } catch (unexpectedError) {
      console.error("Erreur inattendue handleSave :", unexpectedError);
      setError("Une erreur inattendue est survenue pendant l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  if (checkingAuth || loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">
          Chargement de la partie...
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/70">
              Administration
            </p>

            <h1 className="text-3xl font-semibold text-white">
              Modifier une partie
            </h1>

            <p className="text-sm text-slate-400">
              Partie : {game?.partie_id} · {activeResults.length} joueurs
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {success}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="relative flex flex-col gap-2">
              <span className="text-sm text-slate-300">Date de la partie</span>

              <button
                type="button"
                onClick={() => setShowDatePicker((current) => !current)}
                className="flex w-full items-center justify-between rounded-2xl border border-cyan-300/30 bg-white/[0.04] px-4 py-4 text-left text-white outline-none transition hover:border-cyan-300/60 hover:bg-white/[0.07]"
              >
                <span>{formatDateForDisplay(playedAt)}</span>
                <CalendarDays className="h-5 w-5 text-cyan-200" />
              </button>

              {showDatePicker && (
                <div className="absolute left-0 top-full z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl">
                  {buildDateOptions().map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setPlayedAt(option.value);
                        setShowDatePicker(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${
                        option.value === playedAt
                          ? "bg-cyan-300/15 text-cyan-200"
                          : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span>{option.label}</span>
                      {option.value === playedAt && (
                        <Check className="h-4 w-4 text-cyan-200" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-300">Lieu</span>
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ex : Bureau, Seenovate..."
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricCard label="Joueurs" value={activeResults.length} />
            <MetricCard label="Vainqueur auto" value={winner?.player_name ?? "—"} />
            <MetricCard label="Score gagnant" value={winner?.score ?? "—"} />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-semibold text-white">Résultats</h2>
              <p className="text-sm text-slate-400">
                Les positions et le vainqueur sont recalculés automatiquement.
              </p>
            </div>

            <button
              type="button"
              onClick={addResultRow}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950"
            >
              <UserPlus className="h-4 w-4" />
              Ajouter un joueur
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full min-w-[950px] border-collapse">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-4 py-4">Position</th>
                  <th className="px-4 py-4">Joueur</th>
                  <th className="px-4 py-4">Score</th>
                  <th className="px-4 py-4">Statut</th>
                  <th className="px-4 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {recalculatedResults.map((result) => {
                  const scoreMissing = result.score.trim() === "";

                  return (
                    <tr key={result.id} className="border-t border-white/10">
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            result.position === 1
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                              : "border-white/10 bg-white/[0.04] text-slate-300"
                          }`}
                        >
                          {result.position ? `#${result.position}` : "—"}
                        </span>
                      </td>

                      <td className="relative px-4 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenPlayerSelectId((current) =>
                              current === result.id ? null : result.id
                            )
                          }
                          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-white transition hover:border-cyan-300/50 hover:bg-white/[0.07]"
                        >
                          <span>{result.player_name || "Sélectionner un joueur"}</span>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </button>

                        {openPlayerSelectId === result.id && (
                          <div className="absolute left-4 right-4 top-[calc(100%-0.5rem)] z-30 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl">
                            {players.map((player) => {
                              const alreadySelected =
                                selectedPlayerIds.includes(player.id) &&
                                player.id !== result.player_id;

                              return (
                                <button
                                  key={player.id}
                                  type="button"
                                  disabled={alreadySelected}
                                  onClick={() =>
                                    updateResultPlayer(result.id, player.id)
                                  }
                                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${
                                    alreadySelected
                                      ? "cursor-not-allowed text-slate-600"
                                      : player.id === result.player_id
                                        ? "bg-cyan-300/15 text-cyan-200"
                                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                                  }`}
                                >
                                  <span>
                                    {player.display_name}
                                    {alreadySelected ? " — déjà sélectionné" : ""}
                                    {!player.is_active ? " — inactif" : ""}
                                  </span>

                                  {player.id === result.player_id && (
                                    <Check className="h-4 w-4 text-cyan-200" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <input
                          type="number"
                          value={result.score}
                          onChange={(event) =>
                            updateResultScore(result.id, event.target.value)
                          }
                          placeholder="Score obligatoire"
                          className={`w-full rounded-xl border px-3 py-3 text-white outline-none transition placeholder:text-slate-500 ${
                            scoreMissing
                              ? "border-amber-400/50 bg-amber-400/10 focus:border-amber-300"
                              : "border-white/10 bg-white/[0.04] focus:border-cyan-300/60"
                          }`}
                        />

                        {scoreMissing && (
                          <p className="mt-2 text-xs text-amber-300">
                            Score obligatoire
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {result.is_winner ? (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            Vainqueur auto
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                            Participant
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeResultRow(result.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400 hover:text-slate-950"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => router.push(`/games/${game?.partie_id ?? ""}`)}
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </main>
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}