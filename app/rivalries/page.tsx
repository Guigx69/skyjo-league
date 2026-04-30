"use client";

import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

export default function RivalriesPage() {
  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const data = useSkyjoData();

  if (checkingAuth || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement des rivalités...
        </div>
      </main>
    );
  }

  const rivalries = data.rivalries;

  if (!rivalries.length) {
    return (
      <AppShell>
        <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Rivalités
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Aucune rivalité disponible.
          </h1>
          <p className="mt-3 text-sm text-amber-100/80">
            Importe un fichier Excel complet depuis la page Admin.
          </p>
        </div>
      </AppShell>
    );
  }

  const mostPlayedRivalry = rivalries.reduce((a: any, b: any) =>
    a.games > b.games ? a : b
  );

  const strongestRivalry =
    rivalries.find((rivalry: any) => rivalry.intensity === "Forte") ??
    mostPlayedRivalry;

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-red-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-red-500/20 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-300/80">
              Rivalités
            </p>

            <h1 className="mt-4 text-4xl font-semibold text-white md:text-5xl">
              Duels entre joueurs
            </h1>

            <p className="mt-4 max-w-2xl text-sm text-zinc-300">
              Analyse des confrontations directes, domination et intensité des
              rivalités à partir des résultats importés.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6">
            <p className="text-sm text-zinc-400">Rivalités actives</p>
            <p className="mt-3 text-4xl font-semibold text-white">
              {rivalries.length}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6">
            <p className="text-sm text-zinc-400">Duel le plus joué</p>
            <p className="mt-3 text-xl font-semibold text-white">
              {mostPlayedRivalry.playerA} vs {mostPlayedRivalry.playerB}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {mostPlayedRivalry.games} confrontations
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6">
            <p className="text-sm text-zinc-400">Match le plus intense</p>
            <p className="mt-3 text-xl font-semibold text-white">
              {strongestRivalry.playerA} vs {strongestRivalry.playerB}
            </p>
            <p className="mt-2 text-sm text-red-300">
              Intensité : {strongestRivalry.intensity}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rivalries.map((rivalry: any) => {
            const winrateA = Math.round(
              (rivalry.winsA / rivalry.games) * 100
            );
            const winrateB = Math.round(
              (rivalry.winsB / rivalry.games) * 100
            );

            return (
              <div
                key={`${rivalry.playerA}-${rivalry.playerB}`}
                className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-white">
                    {rivalry.playerA} vs {rivalry.playerB}
                  </h2>

                  <span className="text-xs text-zinc-400">
                    {rivalry.games} matchs
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{ width: `${winrateA}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-sm text-zinc-300">
                    <span>
                      {rivalry.playerA} ({winrateA}%)
                    </span>
                    <span>
                      {rivalry.playerB} ({winrateB}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black/20 p-3">
                      <p className="text-xs text-zinc-500">Victoires</p>
                      <p className="mt-1 font-semibold text-white">
                        {rivalry.winsA} - {rivalry.winsB}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/20 p-3">
                      <p className="text-xs text-zinc-500">Dominant</p>
                      <p className="mt-1 font-semibold text-white">
                        {rivalry.domination}
                      </p>
                    </div>
                  </div>

                  <span className="inline-block rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-300">
                    Intensité : {rivalry.intensity}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}