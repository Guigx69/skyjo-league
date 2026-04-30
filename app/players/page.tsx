"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

export default function PlayersPage() {
  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const data = useSkyjoData();

  if (checkingAuth || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        Chargement des joueurs...
      </main>
    );
  }

  const players = data.players;

  return (
    <AppShell>
      <div className="space-y-10">
        {/* HEADER */}
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] to-blue-500/[0.08] p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-300/80">
            Joueurs
          </p>

          <h1 className="mt-4 text-4xl font-semibold text-white">
            Effectif de la ligue
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Données issues du fichier Excel importé.
          </p>
        </section>

        {/* KPI */}
        <section className="grid gap-4 md:grid-cols-4">
          <KPI title="Joueurs" value={players.length} />

          <KPI
            title="Meilleur Elo"
            value={Math.max(...players.map((p: any) => p.elo))}
          />

          <KPI
            title="Parties totales"
            value={players.reduce(
              (sum: number, p: any) => sum + p.games,
              0
            )}
          />

          <KPI
            title="Best score"
            value={Math.min(...players.map((p: any) => p.bestScore))}
          />
        </section>

        {/* LISTE JOUEURS */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {players.map((player: any) => (
            <article
              key={player.id}
              className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] transition hover:bg-white/[0.065]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                    Joueur
                  </p>

                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    {player.name}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {player.email}
                  </p>
                </div>

                <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-200">
                  {player.status}
                </span>
              </div>

              {/* ELO */}
              <div className="mt-6">
                <p className="text-5xl font-semibold tracking-tight text-white">
                  {player.elo}
                </p>
                <p className="mt-1 text-sm text-zinc-400">points Elo</p>
              </div>

              {/* STATS */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Stat label="Winrate" value={`${player.winRate}%`} />
                <Stat label="Parties" value={player.games} />
                <Stat label="Score moyen" value={player.avgScore} />
                <Stat label="Best score" value={player.bestScore} />
              </div>

              {/* BOUTON FICHE DETAILLEE */}
              <Link
                href={`/players/${player.id}`}
                className="mt-6 block w-full rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
              >
                Voir la fiche détaillée
              </Link>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

/* ========================= */
/* COMPONENTS */
/* ========================= */

function KPI({ title, value }: any) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}