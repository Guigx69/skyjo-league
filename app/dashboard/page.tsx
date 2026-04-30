"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

const quickLinks = [
  {
    href: "/leaderboard",
    label: "Voir le classement",
    description: "Elo, winrate et podium",
  },
  {
    href: "/players",
    label: "Explorer les joueurs",
    description: "Stats individuelles",
  },
  {
    href: "/rivalries",
    label: "Analyser les rivalités",
    description: "Duels et domination",
  },
  {
    href: "/games",
    label: "Consulter les parties",
    description: "Historique des matchs",
  },
];

export default function DashboardPage() {
  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const data = useSkyjoData();
  const [userEmail, setUserEmail] = useState<string | undefined>();

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email);
    };

    getUser();
  }, []);

  if (checkingAuth || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300 shadow-2xl">
          Chargement du dashboard...
        </div>
      </main>
    );
  }

  const players = data.players;
  const games = data.games;
  const rivalries = data.rivalries;

  const champion = players[0];
  const hotRivalry = rivalries[0];

  const bestScore =
    players.length > 0
      ? Math.min(...players.map((player: any) => player.bestScore))
      : 0;

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-[-100px] left-[20%] h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
                Skyjo Seenovate
              </p>

              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Vue d’ensemble de la ligue
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                Synthèse de la saison active : classement, dynamique des joueurs,
                dernières parties et rivalités majeures.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-300">
                  Saison active · V1
                </div>

                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-200">
                  Données Excel importées
                </div>

                {userEmail && (
                  <div className="rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-medium text-blue-200">
                    {userEmail}
                  </div>
                )}
              </div>
            </div>

            {champion && (
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="text-xs text-zinc-500">Champion actuel</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {champion.name}
                </p>
                <p className="mt-1 text-sm text-blue-300">
                  {champion.elo} Elo
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <KpiCard title="Joueurs actifs" value={players.length} subtitle="Ligue ouverte" tone="emerald" />
          <KpiCard title="Parties jouées" value={games.length} subtitle="Historique actif" tone="blue" />
          <KpiCard title="Meilleur score" value={bestScore} subtitle="Record saison" tone="amber" />
          <KpiCard title="Rivalités actives" value={rivalries.length} subtitle="Duels suivis" tone="red" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Leaderboard
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Top joueurs
                </h2>
              </div>

              <Link
                href="/leaderboard"
                className="text-sm font-medium text-blue-300 hover:text-blue-200"
              >
                Voir tout
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {players.slice(0, 4).map((player: any) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold text-white">
                      #{player.rank}
                    </div>

                    <div>
                      <p className="font-medium text-white">{player.name}</p>
                      <p className="text-xs text-zinc-500">
                        Winrate {player.winRate}%
                      </p>
                    </div>
                  </div>

                  <p className="font-semibold text-blue-300">{player.elo}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Parties
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Derniers matchs
                </h2>
              </div>

              <Link
                href="/games"
                className="text-sm font-medium text-blue-300 hover:text-blue-200"
              >
                Voir tout
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {games.slice(0, 3).map((game: any) => (
                <div
                  key={game.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{game.winner}</p>
                    <p className="text-xs text-zinc-500">{game.date}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                      {game.players} joueurs
                    </span>
                    <span className="text-emerald-300">
                      Score gagnant · {game.bestScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          {hotRivalry && (
            <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-red-500/[0.08] to-white/[0.035] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-300/80">
                Rivalité chaude
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-white">
                {hotRivalry.playerA} vs {hotRivalry.playerB}
              </h2>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Duel majeur avec {hotRivalry.games} confrontations et une
                domination côté {hotRivalry.domination}.
              </p>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-blue-400"
                  style={{
                    width: `${Math.round(
                      (hotRivalry.winsA / hotRivalry.games) * 100
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex justify-between text-sm text-zinc-300">
                <span>
                  {hotRivalry.playerA} ·{" "}
                  {Math.round((hotRivalry.winsA / hotRivalry.games) * 100)}%
                </span>
                <span>
                  {hotRivalry.playerB} ·{" "}
                  {Math.round((hotRivalry.winsB / hotRivalry.games) * 100)}%
                </span>
              </div>

              <Link
                href="/rivalries"
                className="mt-6 block rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
              >
                Voir les rivalités
              </Link>
            </div>
          )}

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Accès rapides
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              Explorer la ligue
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/[0.06]"
                >
                  <p className="text-sm font-medium text-white">
                    {link.label}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {link.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: "emerald" | "blue" | "amber" | "red";
}) {
  const toneClass = {
    emerald: "text-emerald-300",
    blue: "text-blue-300",
    amber: "text-amber-300",
    red: "text-red-300",
  };

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-4 text-4xl font-semibold text-white">{value}</p>
      <p className={`mt-3 text-xs ${toneClass[tone]}`}>{subtitle}</p>
    </div>
  );
}