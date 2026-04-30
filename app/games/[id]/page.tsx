"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

export default function GameDetailPage() {
  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const data = useSkyjoData();
  const params = useParams();
  const gameId = Number(params.id);

  if (checkingAuth || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement de la partie...
        </div>
      </main>
    );
  }

  const game = data.games.find((item: any) => item.id === gameId);

  if (!game) {
    return (
      <AppShell>
        <div className="rounded-[2rem] border border-red-400/20 bg-red-400/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300">
            Partie introuvable
          </p>

          <h1 className="mt-4 text-3xl font-semibold text-white">
            Cette partie n’existe pas.
          </h1>

          <Link
            href="/games"
            className="mt-6 inline-block rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white hover:text-slate-950"
          >
            Retour aux parties
          </Link>
        </div>
      </AppShell>
    );
  }

  const results = [...(game.results ?? [])].sort(
    (a: any, b: any) => b.score - a.score
  );

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative">
            <Link
              href="/games"
              className="text-sm font-medium text-blue-300 hover:text-blue-200"
            >
              ← Retour aux parties
            </Link>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
              Détail partie
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Partie du {game.date}
            </h1>

            <p className="mt-3 text-sm text-zinc-400">
              {game.location} · {game.players} joueurs
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <KpiCard title="Vainqueur" value={game.winner} />
          <KpiCard title="Score gagnant" value={game.bestScore} />
          <KpiCard title="Pire score" value={game.worstScore} />
          <KpiCard title="Joueurs" value={game.players} />
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Table
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-white">
                Scores autour de la table
              </h2>
            </div>

            <p className="text-sm text-zinc-400">
              Ordre simulé : pire score → meilleur score.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {results.map((result: any, index: number) => (
              <div
                key={`${result.playerId}-${result.playerName}`}
                className={`rounded-[1.5rem] border p-5 ${
                  result.position === 1
                    ? "border-emerald-400/30 bg-emerald-400/10"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                      Siège {index + 1}
                    </p>

                    <h3 className="mt-3 text-xl font-semibold text-white">
                      {result.playerName}
                    </h3>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      result.position === 1
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                        : "border-white/10 bg-white/[0.05] text-zinc-300"
                    }`}
                  >
                    #{result.position}
                  </span>
                </div>

                <p className="mt-6 text-4xl font-semibold text-white">
                  {result.score}
                </p>

                <p className="mt-1 text-sm text-zinc-500">points</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Classement de la partie
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="px-4 py-4">Position</th>
                  <th className="px-4 py-4">Joueur</th>
                  <th className="px-4 py-4">Score</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {[...(game.results ?? [])]
                  .sort((a: any, b: any) => a.position - b.position)
                  .map((result: any) => (
                    <tr
                      key={`${result.playerId}-${result.position}`}
                      className="bg-black/10 transition hover:bg-white/[0.04]"
                    >
                      <td className="px-4 py-4 text-zinc-400">
                        #{result.position}
                      </td>
                      <td className="px-4 py-4 font-medium text-white">
                        {result.playerName}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {result.score}
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

function KpiCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}