"use client";

import { Fragment } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

export default function GamesPage() {
  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const { data, loading } = useSkyjoData();

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement des parties...
        </div>
      </main>
    );
  }

  const games = data.games ?? [];
  const seasons = data.seasons ?? [];

  const seasonsWithGames = seasons
    .map((season: any) => {
      const seasonGames = games
        .filter((game: any) => game.seasonId === season.id)
        .sort((a: any, b: any) => {
          if (b.dateTimestamp !== a.dateTimestamp) {
            return b.dateTimestamp - a.dateTimestamp;
          }

          return b.sortIndex - a.sortIndex;
        });

      return {
        ...season,
        games: seasonGames,
      };
    })
    .filter((season: any) => season.games.length > 0)
    .sort((a: any, b: any) => {
      const seasonA = Number(String(a.id).replace("S", ""));
      const seasonB = Number(String(b.id).replace("S", ""));

      return seasonB - seasonA;
    });

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
              Parties
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Historique des parties
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
              Les parties sont regroupées par saison, avec les saisons et les
              parties les plus récentes affichées en premier.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <KpiCard title="Parties" value={games.length} />
          <KpiCard title="Joueurs max" value={getMaxPlayers(games)} />
          <KpiCard title="Meilleur score" value={getBestGameScore(games)} />
          <KpiCard title="Saisons" value={seasonsWithGames.length} />
        </section>

        <div className="space-y-8">
          {seasonsWithGames.map((season: any) => (
            <section
              key={season.id}
              className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                    {season.id}
                  </p>

                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    {season.name}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    {season.period} · {season.games.length} parties
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${
                    season.status === "Active"
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : season.status === "Pré-saison"
                        ? "border-violet-400/20 bg-violet-400/10 text-violet-300"
                        : "border-white/10 bg-white/[0.05] text-zinc-300"
                  }`}
                >
                  {season.status}
                </span>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-white/10">
                    {groupGamesByDate(season.games).map((group: any) => (
                      <Fragment key={`group-${season.id}-${group.date}`}>
                        <tr className="bg-white/[0.035]">
                          <td
                            colSpan={7}
                            className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200"
                          >
                            {group.date}
                          </td>
                        </tr>

                        <tr className="bg-white/[0.04] text-xs uppercase tracking-[0.18em] text-zinc-500">
                          <th className="px-4 py-4 font-semibold">Partie</th>
                          <th className="px-4 py-4 font-semibold">Lieu</th>
                          <th className="px-4 py-4 font-semibold">Joueurs</th>
                          <th className="px-4 py-4 font-semibold">Vainqueur</th>
                          <th className="px-4 py-4 font-semibold">
                            Score gagnant
                          </th>
                          <th className="px-4 py-4 font-semibold">Pire score</th>
                          <th className="px-4 py-4 text-right font-semibold">
                            Détail
                          </th>
                        </tr>

                        {group.games.map((game: any) => {
                          const winnerDisplay = getWinnerDisplay(game);

                          return (
                            <tr
                              key={game.id}
                              className="bg-black/10 transition hover:bg-white/[0.04]"
                            >
                              <td className="px-4 py-4 text-zinc-400">
                                {game.partieId}
                              </td>

                              <td className="px-4 py-4 text-zinc-300">
                                {game.location}
                              </td>

                              <td className="px-4 py-4 text-zinc-300">
                                {game.players}
                              </td>

                              <td className="px-4 py-4 font-medium text-white">
                                {winnerDisplay}
                              </td>

                              <td className="px-4 py-4 text-emerald-300">
                                {game.bestScore}
                              </td>

                              <td className="px-4 py-4 text-red-300">
                                {game.worstScore}
                              </td>

                              <td className="px-4 py-4 text-right">
                                <Link
                                  href={`/games/${game.partieId ?? game.id}`}
                                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
                                >
                                  Voir la partie
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
    </div>
  );
}

function getWinnerDisplay(game: any) {
  if (Array.isArray(game.winners) && game.winners.length > 0) {
    if (game.winners.length === 1) return game.winners[0];

    return `${game.winners.length} ex æquo`;
  }

  if (Array.isArray(game.results) && game.results.length > 0) {
    const validResults = game.results.filter((result: any) => {
      const score = Number(result.score);
      return Number.isFinite(score);
    });

    if (validResults.length === 0) return game.winner ?? "—";

    const bestScore = Math.min(
      ...validResults.map((result: any) => Number(result.score))
    );

    const winners = validResults.filter(
      (result: any) => Number(result.score) === bestScore
    );

    if (winners.length === 1) {
      return winners[0].playerName ?? winners[0].player_name ?? game.winner ?? "—";
    }

    return `${winners.length} ex æquo`;
  }

  return game.winner ?? "—";
}

function getMaxPlayers(games: any[]) {
  const values = games
    .map((game) => Number(game.players))
    .filter((value) => Number.isFinite(value));

  return values.length > 0 ? Math.max(...values) : "—";
}

function getBestGameScore(games: any[]) {
  const values = games
    .map((game) => Number(game.bestScore))
    .filter((value) => Number.isFinite(value));

  return values.length > 0 ? Math.min(...values) : "—";
}

function groupGamesByDate(games: any[]) {
  const groups = new Map<string, any[]>();

  games.forEach((game) => {
    const key = game.date ?? "Date inconnue";
    groups.set(key, [...(groups.get(key) ?? []), game]);
  });

  return Array.from(groups.entries()).map(([date, dateGames]) => ({
    date,
    games: dateGames.sort((a, b) =>
      String(b.partieId ?? "").localeCompare(String(a.partieId ?? ""), "fr")
    ),
  }));
}