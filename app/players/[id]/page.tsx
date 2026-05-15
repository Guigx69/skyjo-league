"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

export default function PlayerDetailPage() {
  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const { data, loading } = useSkyjoData();
  const params = useParams();
  const playerId = String(params.id ?? "");

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    if (checkingAuth) return;

    async function checkAdmin() {
      try {
        setCheckingAdmin(true);

        const { data: adminResult, error } = await supabase.rpc(
          "is_current_user_admin"
        );

        if (error) {
          console.error("Erreur vérification admin :", error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(adminResult === true);
      } finally {
        setCheckingAdmin(false);
      }
    }

    checkAdmin();
  }, [checkingAuth]);

  if (checkingAuth || loading || checkingAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement de la fiche joueur...
        </div>
      </main>
    );
  }

  const player = data.players.find(
    (p: any) => String(p.joueurId ?? p.id) === playerId
  );

  if (!player) {
    return (
      <AppShell>
        <div className="rounded-[2rem] border border-red-400/20 bg-red-400/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300">
            Joueur introuvable
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-white">
            Cette fiche joueur n’existe pas.
          </h1>

          <Link
            href="/players"
            className="mt-6 inline-block rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white hover:text-slate-950"
          >
            Retour aux joueurs
          </Link>
        </div>
      </AppShell>
    );
  }

  const allPlayerGames = data.games.filter(
    (game: any) =>
      Array.isArray(game.results) &&
      game.results.some(
        (result: any) =>
          result.playerName === player.name ||
          String(result.playerId) === String(player.joueurId)
      )
  );

  const playerGames = allPlayerGames.filter((game: any) => {
    if (Array.isArray(game.winners)) {
      return game.winners.includes(player.name);
    }

    return game.winner === player.name;
  });

  const playerRivalries = data.rivalries.filter(
    (rivalry: any) =>
      rivalry.playerA === player.name || rivalry.playerB === player.name
  );

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <Link
                href="/players"
                className="text-sm font-medium text-blue-300 hover:text-blue-200"
              >
                ← Retour aux joueurs
              </Link>

              {isAdmin && (
                <Link
                  href={`/players/${playerId}/edit`}
                  className="group inline-flex w-fit items-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300 hover:text-slate-950"
                >
                  <Pencil className="h-4 w-4 transition group-hover:rotate-[-8deg]" />
                  Modifier le joueur
                </Link>
              )}
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
              Fiche joueur
            </p>

            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white">
              {player.name}
            </h1>

            <p className="mt-3 text-sm text-zinc-400">{player.email}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-medium text-blue-200">
                {player.status}
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-300">
                Rang #{player.rank}
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-300">
                Forme · {player.form}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Elo" value={player.elo} />
          <KpiCard label="Winrate" value={`${player.winRate}%`} />
          <KpiCard label="Score moyen" value={player.avgScore} />
          <KpiCard label="Meilleur score" value={player.bestScore} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Historique
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              Parties gagnées
            </h2>

            <div className="mt-6 space-y-3">
              {playerGames.length > 0 ? (
                playerGames.map((game: any) => (
                  <div
                    key={game.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex justify-between">
                      <p className="font-medium text-white">{game.location}</p>
                      <p className="text-xs text-zinc-500">{game.date}</p>
                    </div>

                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-zinc-400">
                        {game.players} joueurs
                      </span>
                      <span className="text-emerald-300">
                        Score · {game.bestScore}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">
                  Aucune victoire enregistrée pour ce joueur pour le moment.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Rivalités
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              Duels principaux
            </h2>

            <div className="mt-6 space-y-3">
              {playerRivalries.length > 0 ? (
                playerRivalries.map((rivalry: any) => {
                  const isPlayerA = rivalry.playerA === player.name;
                  const wins = isPlayerA ? rivalry.winsA : rivalry.winsB;
                  const winrate = Math.round((wins / rivalry.games) * 100);
                  const opponent = isPlayerA
                    ? rivalry.playerB
                    : rivalry.playerA;

                  return (
                    <div
                      key={`${rivalry.playerA}-${rivalry.playerB}`}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex justify-between">
                        <p className="font-medium text-white">vs {opponent}</p>
                        <p className="text-xs text-zinc-500">
                          {rivalry.games} matchs
                        </p>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-blue-400"
                          style={{ width: `${winrate}%` }}
                        />
                      </div>

                      <div className="mt-3 flex justify-between text-sm">
                        <span className="text-zinc-400">
                          Winrate duel · {winrate}%
                        </span>
                        <span className="text-red-300">
                          {rivalry.intensity}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">
                  Aucune rivalité enregistrée pour ce joueur.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
    </div>
  );
}