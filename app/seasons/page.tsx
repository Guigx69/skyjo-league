"use client";

import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

export default function SeasonsPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });
  const data = useSkyjoData();

  if (checkingAuth || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement des saisons...
        </div>
      </main>
    );
  }

  const seasons = data.seasons ?? [];
  const activeSeason =
    seasons.find((season: any) => season.status === "Active") ?? seasons[0];

  if (!activeSeason) {
    return (
      <AppShell>
        <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Saisons
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Aucune saison disponible.
          </h1>
          <p className="mt-3 text-sm text-amber-100/80">
            Importe un fichier Excel depuis la page Admin.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-violet-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-300/80">
              Saisons
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Gestion des saisons Skyjo
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
              Les saisons sont calculées automatiquement par trimestre. Les
              parties avant le 01/04/2026 sont rattachées à la pré-saison S00.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard title="Saison active" value={activeSeason.id} />

          <KpiCard title="Parties saison" value={activeSeason.games} />

          <KpiCard title="Leader actuel" value={activeSeason.leader} />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {seasons.map((season: any) => (
            <article
              key={season.id}
              className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                    {season.id}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    {season.name}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    {season.period}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    season.status === "Active"
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : season.status === "Pré-saison"
                        ? "border-violet-400/20 bg-violet-400/10 text-violet-300"
                        : "border-zinc-400/20 bg-white/[0.05] text-zinc-300"
                  }`}
                >
                  {season.status}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <SmallStat label="Parties" value={season.games} />
                <SmallStat label="Joueurs" value={season.players} />
                <SmallStat label="Leader" value={season.leader} />
              </div>
            </article>
          ))}
        </section>
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

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}