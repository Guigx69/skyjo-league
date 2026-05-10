"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { format, isValid, parse, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

type Option = {
  value: string;
  label: string;
};

type Player = {
  id?: string | number;
  JoueurID?: string | number;
  joueurID?: string | number;
  name?: string;
  Nom?: string;
  nom?: string;
};

type Game = {
  id?: string | number;
  PartieID?: string | number;
  partieID?: string | number;
  date?: string | number | Date;
  DatePartie?: string | number | Date;
  datePartie?: string | number | Date;
  dateTimestamp?: number;
  players?: number;
  NbJoueurs?: number;
  nbJoueurs?: number;
  winner?: string;
  bestScore?: number | string;
  worstScore?: number | string;
  location?: string;
  lieu?: string;
  Lieu?: string;
  place?: string;
  season?: string;
  saison?: string;
  results?: Result[];
};

type Result = {
  playerName?: string;
  JoueurNom?: string;
  joueurNom?: string;
  name?: string;
  nom?: string;
  Nom?: string;
  player?: string;
  JoueurID?: string | number;
  joueurID?: string | number;
  score?: number | string;
  Score?: number | string;
  position?: number | string;
  Position?: number | string;
  rank?: number | string;
  Rang?: number | string;
  isWinner?: boolean;
  winner?: boolean;
  win?: boolean;
  victoire?: boolean;
};

type NormalizedResult = {
  name: string;
  playerId?: string | number;
  score?: number;
  position?: number;
  isWinner: boolean;
};

type SeasonStats = {
  id: string;
  name: string;
  period: string;
  startTimestamp: number | null;
  endTimestamp: number | null;
  status: "En cours" | "Terminée" | "À venir";
  games: number;
  players: number;
  leader: string;
  leaderWins: number;
  bestWinRatePlayer: string;
  bestWinRate: number;
  bestAverageScorePlayer: string;
  bestAverageScore?: number;
  mostActivePlayer: string;
  mostActiveGames: number;
  averageWinningScore?: number;
  bestScore?: number;
  worstScore?: number;
  progress: number;
  gamesList: Game[];
  playerRows: SeasonPlayerRow[];
};

type SeasonPlayerRow = {
  name: string;
  games: number;
  wins: number;
  winRate: number;
  averageScore?: number;
  averagePosition?: number;
  bestScore?: number;
};

const sortOptions: Option[] = [
  { value: "timeline", label: "Timeline logique" },
  { value: "games", label: "Volume de parties" },
  { value: "players", label: "Joueurs actifs" },
  { value: "leader", label: "Leader A-Z" },
];

export default function SeasonsPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });
  const { data, loading } = useSkyjoData();

  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("timeline");

  const games = (data?.games ?? []) as Game[];
  const players = (data?.players ?? []) as Player[];

  const seasons = useMemo(() => {
    return buildSeasonsFromGames(games, players);
  }, [games, players]);

  const activeSeason =
    seasons.find((season) => season.status === "En cours") ??
    seasons.find((season) => season.games > 0) ??
    seasons[0];

  const seasonOptions = useMemo<Option[]>(() => {
    return seasons.map((season) => ({
      value: season.id,
      label: `${season.id} · ${season.name}`,
    }));
  }, [seasons]);

  const displayedSeasons = useMemo(() => {
    const filtered =
      selectedSeasons.length === 0
        ? seasons
        : seasons.filter((season) => selectedSeasons.includes(season.id));

    return sortSeasons(filtered, sortBy);
  }, [seasons, selectedSeasons, sortBy]);

  const focusSeason =
    selectedSeasons.length === 1
      ? seasons.find((season) => season.id === selectedSeasons[0]) ?? activeSeason ?? seasons[0]
      : buildAggregateSeason(displayedSeasons);

  const totalGames = seasons.reduce((sum, season) => sum + season.games, 0);
  const totalPlayers = new Set(
    seasons.flatMap((season) => season.playerRows.map((player) => player.name))
  ).size;

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement des saisons...
        </div>
      </main>
    );
  }

  if (!data || seasons.length === 0) {
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
      <div className="w-full max-w-full overflow-x-hidden space-y-8 sm:space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-violet-500/[0.08] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute bottom-[-100px] left-[20%] h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-300/80">
                Saisons
              </p>

              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Gestion des saisons Skyjo
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">
                Les saisons sont reconstruites automatiquement depuis les
                parties importées. S00 correspond à la pré-saison, puis les
                saisons suivantes sont calculées par trimestre à partir
                d’avril 2026.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Badge>{seasons.length} saisons</Badge>
                <Badge>{totalGames} parties</Badge>
                <Badge tone="blue">{totalPlayers} joueurs actifs</Badge>
                {activeSeason && (
                  <Badge tone="violet">En cours · {activeSeason.id}</Badge>
                )}
              </div>
            </div>

            {activeSeason && (
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="text-xs text-zinc-500">Saison active</p>
                <p className="mt-2 text-4xl font-semibold text-white">
                  {activeSeason.id}
                </p>
                <p className="mt-1 text-sm text-violet-200">
                  Leader · {activeSeason.leader}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-slate-950/30 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-5">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.75)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-200/70">
                  Filtres
                </p>
              </div>

              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Périmètre saisonnier
              </h2>

              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Choisis une ou plusieurs saisons. Le tri règle uniquement l’ordre des cartes dans la timeline.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedSeasons([]);
                setSortBy("timeline");
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white hover:text-slate-950"
            >
              Réinitialiser
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <MultiSelectFilter
              label="Saisons"
              placeholder="Toutes les saisons"
              options={seasonOptions}
              values={selectedSeasons}
              onChange={setSelectedSeasons}
            />

            <PremiumSelect
              label="Tri"
              value={sortBy}
              options={sortOptions}
              onChange={setSortBy}
            />
          </div>
        </section>

        {focusSeason && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Périmètre analysé"
                value={focusSeason.id === "GLOBAL" ? "Toutes" : focusSeason.id}
                subtitle={focusSeason.period}
                tone="violet"
              />
              <KpiCard
                title="Parties"
                value={focusSeason.games}
                subtitle="Parties dans la période"
                tone="blue"
              />
              <KpiCard
                title="Leader"
                value={focusSeason.leader}
                subtitle={`${focusSeason.leaderWins} victoire${
                  focusSeason.leaderWins > 1 ? "s" : ""
                }`}
                tone="emerald"
              />
              <KpiCard
                title="Score gagnant moyen"
                value={formatMaybeNumber(focusSeason.averageWinningScore)}
                subtitle="Plus bas = meilleur"
                tone="amber"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <article className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
                <div className="absolute right-[-70px] top-[-70px] h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />

                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                      Focus saison
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      {focusSeason.name}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {focusSeason.period}
                    </p>
                  </div>

                  {focusSeason.id !== "GLOBAL" && <SeasonBadge status={focusSeason.status} />}
                </div>

                <div className="relative mt-6">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Progression</span>
                    <span>{Math.round(focusSeason.progress)}%</span>
                  </div>

                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-violet-400"
                      style={{ width: `${focusSeason.progress}%` }}
                    />
                  </div>
                </div>

                <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
                  <SmallStat label="Joueurs actifs" value={focusSeason.players} />
                  <SmallStat
                    label="Joueur le + actif"
                    value={focusSeason.mostActivePlayer}
                  />
                  <SmallStat
                    label="Meilleur Win Rate"
                    value={`${focusSeason.bestWinRatePlayer} · ${formatMaybeNumber(
                      focusSeason.bestWinRate
                    )}%`}
                  />
                  <SmallStat
                    label="Meilleur score moyen"
                    value={`${focusSeason.bestAverageScorePlayer} · ${formatMaybeNumber(
                      focusSeason.bestAverageScore
                    )}`}
                  />
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                      Podium saison
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      Top joueurs
                    </h2>
                  </div>

                  <p className="text-sm text-zinc-400">
                    Tri par victoires, puis win rate.
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  {focusSeason.playerRows.slice(0, 5).map((player, index) => (
                    <PlayerRow key={player.name} player={player} rank={index + 1} />
                  ))}

                  {focusSeason.playerRows.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-500">
                      Aucun joueur sur cette saison.
                    </div>
                  )}
                </div>
              </article>
            </section>
          </>
        )}

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Timeline
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Toutes les saisons
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Vue chronologique avec volume, leader et statut de chaque
                période.
              </p>
            </div>

            <p className="text-sm text-zinc-400">
              {displayedSeasons.length} saison
              {displayedSeasons.length > 1 ? "s" : ""} affichée
              {displayedSeasons.length > 1 ? "s" : ""}
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {displayedSeasons.map((season) => (
              <SeasonCard
                key={season.id}
                season={season}
                active={focusSeason?.id === season.id}
                onSelect={() => setSelectedSeasons([season.id])}
              />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PremiumSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-2">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-white/10 bg-[#020617] px-3 text-sm font-semibold text-white outline-none transition hover:border-violet-400/40 focus:border-violet-400/60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}


function MultiSelectFilter({
  label,
  placeholder,
  options,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useCloseOnOutsideClick(containerRef, () => setOpen(false));

  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

  const displayLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} saisons sélectionnées`;

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }

    onChange([...values, value]);
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-white/10 bg-white/[0.035] p-2"
    >
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#020617] px-3 text-left text-sm font-semibold text-white outline-none transition hover:border-violet-400/40 focus:border-violet-400/60"
      >
        <span className={values.length === 0 ? "truncate text-zinc-500" : "truncate"}>
          {displayLabel}
        </span>

        <span className="flex items-center gap-2">
          {values.length > 0 && (
            <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-xs font-semibold text-violet-200">
              {values.length}
            </span>
          )}
          <span className="text-zinc-500">⌄</span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.6rem)] z-50 w-full min-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#020617] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
          <div className="max-h-72 overflow-y-auto pr-1">
            {options.map((option) => {
              const checked = values.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleValue(option.value)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.06]"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                      checked
                        ? "border-violet-400 bg-violet-500 text-white"
                        : "border-white/15 bg-white/[0.03] text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={checked ? "text-white" : "text-zinc-400"}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
            >
              Toutes les saisons
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function useCloseOnOutsideClick(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    const handleClick = (event: MouseEvent | TouchEvent) => {
      const element = ref.current;

      if (!element) return;

      if (!element.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [ref, onClose]);
}


function SeasonCard({
  season,
  active,
  onSelect,
}: {
  season: SeasonStats;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative overflow-hidden rounded-[1.75rem] border p-5 text-left shadow-[0_24px_70px_rgba(0,0,0,0.18)] transition hover:bg-white/[0.035] sm:p-6 ${
        active
          ? "border-violet-400/35 bg-violet-400/[0.08]"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="absolute right-[-70px] top-[-70px] h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            {season.id}
          </p>
          <h3 className="mt-3 truncate text-xl font-semibold text-white">
            {season.name}
          </h3>
          <p className="mt-2 text-sm text-zinc-400">{season.period}</p>
        </div>

        <SeasonBadge status={season.status} />
      </div>

      <div className="relative mt-5">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Progression</span>
          <span>{Math.round(season.progress)}%</span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-violet-400"
            style={{ width: `${season.progress}%` }}
          />
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3">
        <SmallStat label="Parties" value={season.games} />
        <SmallStat label="Joueurs" value={season.players} />
        <SmallStat label="Leader" value={season.leader} />
      </div>
    </button>
  );
}

function PlayerRow({
  player,
  rank,
}: {
  player: SeasonPlayerRow;
  rank: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold text-white">
          #{rank}
        </div>

        <div className="min-w-0">
          <p className="truncate font-medium text-white">{player.name}</p>
          <p className="text-xs text-zinc-500">
            {player.games} parties · {player.wins} victoires
          </p>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-semibold text-violet-200">
          {formatMaybeNumber(player.winRate)}%
        </p>
        <p className="text-xs text-zinc-500">
          Moy. {formatMaybeNumber(player.averageScore)}
        </p>
      </div>
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
  tone: "emerald" | "blue" | "amber" | "violet";
}) {
  const toneClass = {
    emerald: "text-emerald-300",
    blue: "text-blue-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  }[tone];

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-4 truncate text-3xl font-semibold text-white">
        {value || "—"}
      </p>
      <p className={`mt-3 text-xs ${toneClass}`}>{subtitle}</p>
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
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white sm:text-base">
        {value || "—"}
      </p>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "blue" | "violet";
}) {
  const className = {
    default: "border-white/10 bg-white/[0.06] text-zinc-300",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  }[tone];

  return (
    <div className={`max-w-full truncate rounded-full border px-4 py-2 text-xs font-medium ${className}`}>
      {children}
    </div>
  );
}

function SeasonBadge({ status }: { status: SeasonStats["status"] }) {
  const className = {
    "En cours": "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    Terminée: "border-zinc-400/20 bg-white/[0.05] text-zinc-300",
    "À venir": "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  }[status];

  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}


function buildAggregateSeason(seasons: SeasonStats[]): SeasonStats {
  if (seasons.length === 1) return seasons[0];

  const games = seasons.flatMap((season) => season.gamesList);
  const playerMap = new Map<string, SeasonPlayerRow>();

  seasons.forEach((season) => {
    season.playerRows.forEach((player) => {
      if (!playerMap.has(player.name)) {
        playerMap.set(player.name, {
          name: player.name,
          games: 0,
          wins: 0,
          winRate: 0,
          averageScore: undefined,
          averagePosition: undefined,
          bestScore: undefined,
        });
      }

      const row = playerMap.get(player.name);
      if (!row) return;

      row.games += player.games;
      row.wins += player.wins;
      row.bestScore =
        row.bestScore === undefined
          ? player.bestScore
          : player.bestScore === undefined
            ? row.bestScore
            : Math.min(row.bestScore, player.bestScore);
    });
  });

  const playerRows = Array.from(playerMap.values())
    .map((player) => ({
      ...player,
      winRate: player.games > 0 ? (player.wins / player.games) * 100 : 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

  const leader = playerRows[0];
  const winningScores = seasons
    .map((season) => season.averageWinningScore)
    .filter((value): value is number => isFiniteNumber(value));

  return {
    id: "GLOBAL",
    name: "Vue consolidée",
    period: seasons.length === 0 ? "Aucune saison" : `${seasons.length} saisons sélectionnées`,
    startTimestamp: seasons[0]?.startTimestamp ?? null,
    endTimestamp: seasons[seasons.length - 1]?.endTimestamp ?? null,
    status: "Terminée",
    games: seasons.reduce((sum, season) => sum + season.games, 0),
    players: playerRows.length,
    leader: leader?.name ?? "—",
    leaderWins: leader?.wins ?? 0,
    bestWinRatePlayer: playerRows[0]?.name ?? "—",
    bestWinRate: playerRows[0]?.winRate ?? 0,
    bestAverageScorePlayer: "—",
    bestAverageScore: undefined,
    mostActivePlayer:
      [...playerRows].sort((a, b) => b.games - a.games)[0]?.name ?? "—",
    mostActiveGames:
      [...playerRows].sort((a, b) => b.games - a.games)[0]?.games ?? 0,
    averageWinningScore: average(winningScores),
    bestScore: undefined,
    worstScore: undefined,
    progress: 100,
    gamesList: games,
    playerRows,
  };
}


function buildSeasonsFromGames(games: Game[], players: Player[]): SeasonStats[] {
  const grouped = new Map<string, Game[]>();

  games.forEach((game) => {
    const seasonId = getGameSeason(game);
    if (!seasonId) return;

    grouped.set(seasonId, [...(grouped.get(seasonId) ?? []), game]);
  });

  const generatedIds = Array.from(grouped.keys()).sort(
    (a, b) => getSeasonSortValue(a) - getSeasonSortValue(b)
  );

  const builtSeasons = generatedIds.map((seasonId) => {
    const seasonGames = grouped.get(seasonId) ?? [];
    return buildSeasonStats(seasonId, seasonGames, players);
  });

  const activeSeason = builtSeasons.find((season) => season.status === "En cours");

  if (activeSeason && activeSeason.progress >= 80) {
    const nextSeasonId = getNextSeasonId(activeSeason.id);

    if (nextSeasonId && !builtSeasons.some((season) => season.id === nextSeasonId)) {
      builtSeasons.push(buildSeasonStats(nextSeasonId, [], players));
    }
  }

  return builtSeasons;
}

function buildSeasonStats(
  seasonId: string,
  games: Game[],
  players: Player[]
): SeasonStats {
  const meta = getSeasonMeta(seasonId);
  const playerRows = buildSeasonPlayerRows(games, players);
  const leaderRow = playerRows[0];

  const bestWinRateRow =
    [...playerRows]
      .filter((player) => player.games >= 2)
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0] ??
    playerRows[0];

  const bestAverageScoreRow =
    [...playerRows]
      .filter((player) => isFiniteNumber(player.averageScore))
      .sort((a, b) => (a.averageScore ?? 999) - (b.averageScore ?? 999))[0] ??
    playerRows[0];

  const mostActiveRow =
    [...playerRows].sort((a, b) => b.games - a.games || b.wins - a.wins)[0] ??
    playerRows[0];

  const winningScores = getWinningScores(games);
  const allScores = getAllScores(games);

  return {
    id: seasonId,
    name: meta.name,
    period: meta.period,
    startTimestamp: meta.startTimestamp,
    endTimestamp: meta.endTimestamp,
    status: getSeasonStatus(meta.startTimestamp, meta.endTimestamp, seasonId),
    games: games.length,
    players: playerRows.length,
    leader: leaderRow?.name ?? "—",
    leaderWins: leaderRow?.wins ?? 0,
    bestWinRatePlayer: bestWinRateRow?.name ?? "—",
    bestWinRate: bestWinRateRow?.winRate ?? 0,
    bestAverageScorePlayer: bestAverageScoreRow?.name ?? "—",
    bestAverageScore: bestAverageScoreRow?.averageScore,
    mostActivePlayer: mostActiveRow?.name ?? "—",
    mostActiveGames: mostActiveRow?.games ?? 0,
    averageWinningScore: average(winningScores),
    bestScore: allScores.length > 0 ? Math.min(...allScores) : undefined,
    worstScore: allScores.length > 0 ? Math.max(...allScores) : undefined,
    progress: getSeasonProgress(meta.startTimestamp, meta.endTimestamp),
    gamesList: games,
    playerRows,
  };
}

function buildSeasonPlayerRows(
  games: Game[],
  players: Player[]
): SeasonPlayerRow[] {
  const knownPlayers = new Map<string, Player>();

  players.forEach((player) => {
    const name = getPlayerName(player);
    if (name) knownPlayers.set(name, player);
  });

  const rows = new Map<
    string,
    {
      name: string;
      games: number;
      wins: number;
      scores: number[];
      positions: number[];
    }
  >();

  games.forEach((game) => {
    const results = Array.isArray(game.results) ? game.results : [];
    const normalized = results
      .map((result) => normalizeResult(result))
      .filter((result) => result.name);

    const winners = getWinnerNames(normalized);

    normalized.forEach((result) => {
      if (!rows.has(result.name)) {
        rows.set(result.name, {
          name: result.name,
          games: 0,
          wins: 0,
          scores: [],
          positions: [],
        });
      }

      const row = rows.get(result.name);
      if (!row) return;

      row.games += 1;
      if (winners.includes(result.name)) row.wins += 1;
      if (isFiniteNumber(result.score)) row.scores.push(result.score);
      if (isFiniteNumber(result.position)) row.positions.push(result.position);
    });
  });

  return Array.from(rows.values())
    .map((row) => ({
      name: row.name,
      games: row.games,
      wins: row.wins,
      winRate: row.games > 0 ? (row.wins / row.games) * 100 : 0,
      averageScore: average(row.scores),
      averagePosition: average(row.positions),
      bestScore: row.scores.length > 0 ? Math.min(...row.scores) : undefined,
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        (a.averageScore ?? 999) - (b.averageScore ?? 999)
    );
}

function getWinningScores(games: Game[]) {
  const scores: number[] = [];

  games.forEach((game) => {
    const results = Array.isArray(game.results) ? game.results : [];
    const normalized = results
      .map((result) => normalizeResult(result))
      .filter((result) => result.name);

    const winners = getWinnerNames(normalized);

    normalized.forEach((result) => {
      if (winners.includes(result.name) && isFiniteNumber(result.score)) {
        scores.push(result.score);
      }
    });

    if (winners.length === 0) {
      const bestScore = toNumber(game.bestScore);
      if (isFiniteNumber(bestScore)) scores.push(bestScore);
    }
  });

  return scores;
}

function getAllScores(games: Game[]) {
  return games.flatMap((game) => {
    const results = Array.isArray(game.results) ? game.results : [];
    return results
      .map((result) => normalizeResult(result).score)
      .filter((value): value is number => isFiniteNumber(value));
  });
}

function normalizeResult(result: Result): NormalizedResult {
  const name =
    result.playerName ??
    result.JoueurNom ??
    result.joueurNom ??
    result.name ??
    result.player ??
    result.nom ??
    result.Nom;

  const score = toNumber(result.score ?? result.Score);
  const position = toNumber(
    result.position ?? result.Position ?? result.rank ?? result.Rang
  );

  return {
    name: name ? String(name) : "",
    playerId: result.JoueurID ?? result.joueurID,
    score,
    position,
    isWinner:
      result.isWinner === true ||
      result.winner === true ||
      result.win === true ||
      result.victoire === true ||
      position === 1,
  };
}

function getWinnerNames(results: NormalizedResult[]) {
  const explicitWinners = results
    .filter((result) => result.isWinner)
    .map((result) => result.name);

  if (explicitWinners.length > 0) return explicitWinners;

  const positioned = results.filter((result) => isFiniteNumber(result.position));

  if (positioned.length > 0) {
    const bestPosition = Math.min(
      ...positioned.map((result) => result.position as number)
    );

    return positioned
      .filter((result) => result.position === bestPosition)
      .map((result) => result.name);
  }

  const scored = results.filter((result) => isFiniteNumber(result.score));

  if (scored.length > 0) {
    const bestScore = Math.min(
      ...scored.map((result) => result.score as number)
    );

    return scored
      .filter((result) => result.score === bestScore)
      .map((result) => result.name);
  }

  return [];
}

function sortSeasons(seasons: SeasonStats[], sortBy: string) {
  return [...seasons].sort((a, b) => {
    if (sortBy === "games") return b.games - a.games || getSeasonTimelineRank(a) - getSeasonTimelineRank(b);
    if (sortBy === "players") return b.players - a.players || getSeasonTimelineRank(a) - getSeasonTimelineRank(b);
    if (sortBy === "leader") return a.leader.localeCompare(b.leader, "fr");

    return getSeasonTimelineRank(a) - getSeasonTimelineRank(b);
  });
}


function getSeasonTimelineRank(season: SeasonStats) {
  const statusRank = {
    "À venir": 0,
    "En cours": 1,
    Terminée: 2,
  }[season.status];

  return statusRank * 1000 - getSeasonSortValue(season.id);
}

function getNextSeasonId(seasonId: string) {
  if (seasonId === "S00") return "S01";

  const seasonNumber = Number(seasonId.replace("S", ""));

  if (!Number.isFinite(seasonNumber)) return null;

  return `S${String(seasonNumber + 1).padStart(2, "0")}`;
}

function getGameSeason(game: Game) {
  const explicitSeason = game.season ?? game.saison;
  if (explicitSeason) return String(explicitSeason);

  const timestamp = getGameDateValue(game);
  if (timestamp === null) return null;

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (year < 2026 || (year === 2026 && month < 4)) return "S00";

  const monthsSinceApril2026 = (year - 2026) * 12 + (month - 4);
  const seasonIndex = Math.floor(monthsSinceApril2026 / 3) + 1;

  return `S${String(seasonIndex).padStart(2, "0")}`;
}

function getSeasonMeta(seasonId: string) {
  if (seasonId === "S00") {
    return {
      name: "Pré-saison",
      period: "Avant avril 2026",
      startTimestamp: null,
      endTimestamp: new Date(2026, 3, 1).getTime() - 1,
    };
  }

  const seasonNumber = Number(seasonId.replace("S", ""));

  if (!Number.isFinite(seasonNumber)) {
    return {
      name: seasonId,
      period: "Période inconnue",
      startTimestamp: null,
      endTimestamp: null,
    };
  }

  const startMonthIndex = 3 + (seasonNumber - 1) * 3;
  const startDate = new Date(2026, startMonthIndex, 1);
  const endDate = new Date(2026, startMonthIndex + 3, 0, 23, 59, 59, 999);

  return {
    name: `Saison ${seasonNumber}`,
    period: `${format(startDate, "MMMM yyyy", { locale: fr })} - ${format(
      endDate,
      "MMMM yyyy",
      { locale: fr }
    )}`,
    startTimestamp: startDate.getTime(),
    endTimestamp: endDate.getTime(),
  };
}

function getSeasonStatus(
  startTimestamp: number | null,
  endTimestamp: number | null,
  seasonId: string
): SeasonStats["status"] {
  if (seasonId === "S00") return "Terminée";
  if (!startTimestamp || !endTimestamp) return "Terminée";

  const now = Date.now();

  if (now < startTimestamp) return "À venir";
  if (now <= endTimestamp) return "En cours";

  return "Terminée";
}

function getSeasonProgress(
  startTimestamp: number | null,
  endTimestamp: number | null
) {
  if (!startTimestamp || !endTimestamp) return 100;

  const now = Date.now();

  if (now <= startTimestamp) return 0;
  if (now >= endTimestamp) return 100;

  return ((now - startTimestamp) / (endTimestamp - startTimestamp)) * 100;
}

function getSeasonSortValue(season: string) {
  if (season === "S00") return 0;

  const value = Number(season.replace("S", ""));
  return Number.isFinite(value) ? value : 999;
}

function getPlayerName(player: Player) {
  return player.name ?? player.Nom ?? player.nom ?? "";
}

function getGameDateValue(game: Game) {
  if (game.dateTimestamp) {
    const timestamp = Number(game.dateTimestamp);
    return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  }

  const rawDate = game.date ?? game.DatePartie ?? game.datePartie;
  if (!rawDate) return null;

  if (rawDate instanceof Date) {
    const timestamp = rawDate.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof rawDate === "number") {
    if (rawDate > 30_000 && rawDate < 80_000) {
      return excelSerialDateToTimestamp(rawDate);
    }

    return rawDate < 1_000_000_000_000 ? rawDate * 1000 : rawDate;
  }

  const value = String(rawDate);

  if (value.includes("-")) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const parsedFr = parse(value, "dd/MM/yyyy", new Date());

  if (isValid(parsedFr)) {
    return startOfDay(parsedFr).getTime();
  }

  return null;
}

function excelSerialDateToTimestamp(serial: number) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86_400_000;
  const date = new Date(utcValue);

  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ).getTime();
}

function average(values: number[]) {
  if (values.length === 0) return undefined;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function formatMaybeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2).replace(".", ",");
}