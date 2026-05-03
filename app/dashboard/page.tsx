"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";
import ActivityChart from "@/components/charts/ActivityChart";
import PlayersPerGameChart from "@/components/charts/PlayersPerGameChart";
import CompetitivePositionChart from "@/components/charts/CompetitivePositionChart";
import ScoreDistributionChart from "@/components/charts/ScoreDistributionChart";

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

  const { data, loading } = useSkyjoData();
  const [userEmail, setUserEmail] = useState<string | undefined>();

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email);
    };

    getUser();
  }, []);

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300 shadow-2xl">
          Chargement du dashboard...
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <AppShell userEmail={userEmail}>
        <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/[0.08] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Données absentes
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
            Aucun fichier Excel n’a encore été importé.
          </h1>
          <p className="mt-3 text-sm text-amber-100/80">
            Va dans la page Admin pour importer les données Skyjo.
          </p>
        </div>
      </AppShell>
    );
  }

  const players = data.players ?? [];
  const games = data.games ?? [];
  const rivalries = data.rivalries ?? [];

  const champion = players[0];
  const hotRivalry = rivalries[0];

  const bestScore =
    games.length > 0 ? Math.min(...games.map((game: any) => game.bestScore)) : 0;

  const worstScore =
    games.length > 0 ? Math.max(...games.map((game: any) => game.worstScore)) : 0;

  const averageScore =
    games.length > 0
      ? Math.round(
          games.reduce((sum: number, game: any) => sum + game.bestScore, 0) /
            games.length
        )
      : 0;

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-8 sm:space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-[-100px] left-[20%] h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
                Skyjo Seenovate
              </p>

              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Vue d’ensemble de la ligue
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                Synthèse de la saison active : classement, dynamique des joueurs,
                dernières parties et rivalités majeures.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-300">
                  Données Supabase live
                </div>

                {userEmail && (
                  <div className="max-w-full truncate rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-medium text-blue-200">
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

        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard title="Parties" value={games.length} subtitle="Historique actif" tone="blue" />
          <KpiCard title="Joueurs actifs" value={players.length} subtitle="Ligue ouverte" tone="emerald" />
          <KpiCard title="Score moyen" value={averageScore} subtitle="Score gagnant moyen" tone="violet" />
          <KpiCard title="Meilleur score" value={bestScore} subtitle="Record saison" tone="amber" />
          <KpiCard title="Pire score" value={worstScore} subtitle="Score maximum" tone="red" />
          <KpiCard title="Rivalités" value={rivalries.length} subtitle="Duels suivis" tone="red" />
        </section>

        <ChartSection
          eyebrow="Activité"
          title="Activité et tendance des scores"
          description="Évolution des parties, scores minimum, moyen et maximum."
        >
          <ChartViewport minWidth="760px">
            <ActivityChart games={games} />
          </ChartViewport>
        </ChartSection>

        <ChartSection
          eyebrow="Participation"
          title="Nombre de joueurs par partie"
          description="Visualisation du nombre de participants sur chaque partie jouée."
        >
          <ChartViewport minWidth="680px">
            <PlayersPerGameChart games={games} />
          </ChartViewport>
        </ChartSection>

        <ChartSection
          eyebrow="Scores"
          title="Répartition des scores"
          description="Distribution des scores par tranche pour identifier les zones les plus fréquentes."
        >
          <ChartViewport minWidth="640px">
            <ScoreDistributionChart games={games} />
          </ChartViewport>
        </ChartSection>

        <ChartSection
          eyebrow="Positionnement"
          title="Positionnement compétitif des joueurs"
          description="Lecture croisée entre score moyen, taux de victoire et volume de parties."
        >
          <ChartViewport minWidth="980px">
            <CompetitivePositionChart players={players} />
          </ChartViewport>
        </ChartSection>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
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
                className="shrink-0 text-sm font-medium text-blue-300 hover:text-blue-200"
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
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold text-white">
                      #{player.rank}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {player.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Winrate {player.winRate}%
                      </p>
                    </div>
                  </div>

                  <p className="shrink-0 font-semibold text-blue-300">
                    {player.elo}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
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
                className="shrink-0 text-sm font-medium text-blue-300 hover:text-blue-200"
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
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium text-white">
                      {game.winner}
                    </p>
                    <p className="shrink-0 text-xs text-zinc-500">
                      {game.date}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-400">
                      {game.players} joueurs
                    </span>
                    <span className="text-right text-emerald-300">
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
            <div className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-red-500/[0.08] to-white/[0.035] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
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

              <div className="mt-3 flex justify-between gap-3 text-sm text-zinc-300">
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

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
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

function ChartSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {description}
      </p>

      <div className="mt-6">{children}</div>
    </section>
  );
}

function ChartViewport({
  minWidth,
  children,
}: {
  minWidth: string;
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-2">
      <div style={{ minWidth }}>{children}</div>
    </div>
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
  tone: "emerald" | "blue" | "amber" | "red" | "violet";
}) {
  const toneClass = {
    emerald: "text-emerald-300",
    blue: "text-blue-300",
    amber: "text-amber-300",
    red: "text-red-300",
    violet: "text-violet-300",
  };

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
        {value}
      </p>
      <p className={`mt-3 text-xs ${toneClass[tone]}`}>{subtitle}</p>
    </div>
  );
}