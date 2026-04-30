"use client";

import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

type Player = {
  id: number;
  rank: number;
  name: string;
  elo: number;
  winRate: number;
  games: number;
  avgScore: number;
  form: string;
  badge: string;
};

function PodiumCard({
  player,
  variant,
}: {
  player: Player;
  variant: "gold" | "silver" | "bronze";
}) {
  const styles = {
    gold: "border-amber-300/30 bg-amber-300/[0.09] md:-mt-8",
    silver: "border-slate-300/20 bg-white/[0.055]",
    bronze: "border-orange-300/20 bg-orange-300/[0.055]",
  };

  const medals = {
    gold: "1",
    silver: "2",
    bronze: "3",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)] ${styles[variant]}`}
    >
      <div className="absolute right-[-40px] top-[-40px] h-28 w-28 rounded-full bg-white/10 blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
              Rang #{player.rank}
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {player.name}
            </h2>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-lg font-semibold text-white">
            {medals[variant]}
          </div>
        </div>

        <p className="mt-6 text-5xl font-semibold tracking-tight text-white">
          {player.elo}
        </p>
        <p className="mt-1 text-sm text-zinc-400">points Elo</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white">{player.badge}</p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-zinc-500">Winrate</p>
              <p className="mt-1 font-semibold text-white">
                {player.winRate}%
              </p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Parties</p>
              <p className="mt-1 font-semibold text-white">{player.games}</p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Moy.</p>
              <p className="mt-1 font-semibold text-white">
                {player.avgScore}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const { data, loading } = useSkyjoData();

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement du classement...
        </div>
      </main>
    );
  }

  const players = data.players as Player[];
  const first = players[0];
  const second = players[1];
  const third = players[2];

  if (!first || !second || !third) {
    return (
      <AppShell>
        <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Données insuffisantes
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Le classement nécessite au moins 3 joueurs.
          </h1>
          <p className="mt-3 text-sm text-amber-100/80">
            Importe un fichier Excel complet depuis la page Admin.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-[-100px] left-[20%] h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
                Leaderboard
              </p>

              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Classement général de la ligue
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                Podium, Elo, winrate et forme récente des meilleurs joueurs
                Skyjo Seenovate.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
              <p className="text-xs text-zinc-500">Leader actuel</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {first.name}
              </p>
            </div>
          </div>
        </section>

        <section className="grid items-end gap-4 md:grid-cols-3">
          <PodiumCard player={second} variant="silver" />
          <PodiumCard player={first} variant="gold" />
          <PodiumCard player={third} variant="bronze" />
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Classement complet
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Tous les joueurs
              </h2>
            </div>

            <p className="text-sm text-zinc-400">
              Données issues du fichier Excel importé.
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="px-4 py-4">Rang</th>
                  <th className="px-4 py-4">Joueur</th>
                  <th className="px-4 py-4">Elo</th>
                  <th className="px-4 py-4">Winrate</th>
                  <th className="px-4 py-4">Parties</th>
                  <th className="px-4 py-4">Score moyen</th>
                  <th className="px-4 py-4">Forme</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {players.map((player) => (
                  <tr
                    key={player.id}
                    className="bg-black/10 transition hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-4 text-zinc-400">#{player.rank}</td>
                    <td className="px-4 py-4 font-medium text-white">
                      {player.name}
                    </td>
                    <td className="px-4 py-4 text-blue-300">{player.elo}</td>
                    <td className="px-4 py-4 text-zinc-300">
                      {player.winRate}%
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      {player.games}
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      {player.avgScore}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
                        {player.form}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}