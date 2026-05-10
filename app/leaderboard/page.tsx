"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
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
  rank?: number;
  name?: string;
  Nom?: string;
  nom?: string;
  elo?: number;
  winRate?: number;
  games?: number;
  avgScore?: number;
  averageScore?: number;
  badge?: string;
  wins?: number;
  regularity?: number;
  averagePosition?: number;
  relativePerformance?: number;
  status?: string;
  lastActivity?: string;
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
  Lieu?: string;
  lieu?: string;
  season?: string;
  saison?: string;
  results?: Result[];
};

type Result = {
  id?: string | number;
  ResultatID?: string | number;
  PartieID?: string | number;
  partieID?: string | number;
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
  score: number | undefined;
  position: number | undefined;
  isWinner: boolean;
};

type RankedPlayer = {
  id: string | number;
  name: string;
  rank: number;
  historicalRank: number;
  officialRank: number;
  elo: number;
  winRate: number;
  games: number;
  averageScore: number;
  wins: number;
  regularity: number | undefined;
  averagePosition: number | undefined;
  relativePerformance: number | undefined;
  weightedPowerScore: number;
  powerScore: number;
  status: string;
  lastActivity: string;
  lastActivityDate: number | null;
  badge: string;
  dangerScore: number;
  sortValue: number;
};

type VictoryChartPoint = {
  date: string;
  label: string;
  values: Record<string, number>;
};

const monthOptions = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const metricOptions: Option[] = [
  { value: "elo", label: "ELO" },
  { value: "powerScoreWeighted", label: "Power Score pondéré" },
  { value: "powerScore", label: "Power Score Skyjo" },
  { value: "winRate", label: "Win Rate" },
  { value: "averageScore", label: "Score moyen" },
  { value: "games", label: "Parties jouées" },
];

const chartScopeOptions: Option[] = [
  { value: "top5", label: "Top 5" },
  { value: "top10", label: "Top 10" },
  { value: "all", label: "Tous" },
];

export default function LeaderboardPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });
  const { data, loading } = useSkyjoData();

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [playersCountFilter, setPlayersCountFilter] = useState<string[]>([]);
  const [seasonFilter, setSeasonFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [metric, setMetric] = useState("elo");
  const [chartScope, setChartScope] = useState("top10");

  const players = (data?.players ?? []) as Player[];
  const games = (data?.games ?? []) as Game[];

  const gameDateBounds = useMemo(() => {
    const timestamps = games
      .map((game) => getGameDateValue(game))
      .filter((value): value is number => isFiniteNumber(value));

    if (timestamps.length === 0) {
      return { minDate: undefined, maxDate: undefined };
    }

    return {
      minDate: startOfDay(new Date(Math.min(...timestamps))),
      maxDate: startOfDay(new Date(Math.max(...timestamps))),
    };
  }, [games]);

  const playerCountOptions = useMemo<Option[]>(() => {
    return Array.from(
      new Set(
        games
          .map((game) => getGamePlayersCount(game))
          .filter((value): value is number => isFiniteNumber(value))
      )
    )
      .sort((a, b) => a - b)
      .map((count) => ({
        value: String(count),
        label: `${count} joueurs`,
      }));
  }, [games]);

  const seasonOptions = useMemo<Option[]>(() => {
    return Array.from(
      new Set(games.map((game) => getGameSeason(game)).filter(isNonEmptyString))
    )
      .sort((a, b) => getSeasonSortValue(a) - getSeasonSortValue(b))
      .map((season) => ({
        value: season,
        label: getSeasonLabel(season),
      }));
  }, [games]);

  const locationOptions = useMemo<Option[]>(() => {
    return Array.from(
      new Set(games.map((game) => getGameLocation(game)).filter(isNonEmptyString))
    )
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((location) => ({
        value: location,
        label: location,
      }));
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const gameDateValue = getGameDateValue(game);
      const startValue = startDate ? startOfDay(startDate).getTime() : null;
      const endValue = endDate ? endOfDay(endDate).getTime() : null;
      const gameSeason = getGameSeason(game);
      const gamePlayers = String(getGamePlayersCount(game));
      const gameLocation = getGameLocation(game);

      if (startValue !== null && gameDateValue !== null && gameDateValue < startValue) {
        return false;
      }

      if (endValue !== null && gameDateValue !== null && gameDateValue > endValue) {
        return false;
      }

      if (playersCountFilter.length > 0 && !playersCountFilter.includes(gamePlayers)) {
        return false;
      }

      if (seasonFilter.length > 0 && (!gameSeason || !seasonFilter.includes(gameSeason))) {
        return false;
      }

      if (locationFilter.length > 0 && (!gameLocation || !locationFilter.includes(gameLocation))) {
        return false;
      }

      return true;
    });
  }, [games, startDate, endDate, playersCountFilter, seasonFilter, locationFilter]);

  const rawRankedPlayers = useMemo(() => {
    return buildLeaderboard(players, filteredGames, metric);
  }, [players, filteredGames, metric]);

  const statusOptions = useMemo<Option[]>(() => {
    return Array.from(new Set(rawRankedPlayers.map((player) => player.status)))
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((status) => ({
        value: status,
        label: status,
      }));
  }, [rawRankedPlayers]);

  const rankedPlayers = useMemo(() => {
    return rawRankedPlayers.filter((player) => {
      if (statusFilter.length === 0) return true;
      return statusFilter.includes(player.status);
    });
  }, [rawRankedPlayers, statusFilter]);

  const first = rankedPlayers[0];
  const second = rankedPlayers[1];
  const third = rankedPlayers[2];

  const mostRegular = [...rankedPlayers]
    .filter((player) => Number.isFinite(player.regularity))
    .sort((a, b) => (a.regularity ?? 999) - (b.regularity ?? 999))[0];

  const bestWinRate = [...rankedPlayers].sort((a, b) => b.winRate - a.winRate)[0];

  const mostActive = [...rankedPlayers].sort((a, b) => b.games - a.games)[0];

  const mostDangerous = [...rankedPlayers].sort(
    (a, b) => b.dangerScore - a.dangerScore
  )[0];

  const victoryChartPlayers = useMemo(() => {
    if (chartScope === "top5") return rankedPlayers.slice(0, 5);
    if (chartScope === "top10") return rankedPlayers.slice(0, 10);
    return rankedPlayers;
  }, [rankedPlayers, chartScope]);

  const victoryChartData = useMemo(() => {
    return buildCumulativeVictoryData(filteredGames, victoryChartPlayers);
  }, [filteredGames, victoryChartPlayers]);

  const activeFilterCount =
    (startDate || endDate ? 1 : 0) +
    playersCountFilter.length +
    seasonFilter.length +
    statusFilter.length +
    locationFilter.length +
    (metric !== "elo" ? 1 : 0);

  const periodLabel = getPeriodLabel(filteredGames);

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);

    if (date && endDate && isAfter(startOfDay(date), startOfDay(endDate))) {
      setEndDate(undefined);
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);

    if (date && startDate && isBefore(startOfDay(date), startOfDay(startDate))) {
      setStartDate(undefined);
    }
  };

  const resetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setPlayersCountFilter([]);
    setSeasonFilter([]);
    setStatusFilter([]);
    setLocationFilter([]);
    setMetric("elo");
  };

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement du classement...
        </div>
      </main>
    );
  }

  if (rankedPlayers.length < 3) {
    return (
      <AppShell>
        <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Données insuffisantes
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Le classement nécessite au moins 3 joueurs sur le périmètre filtré.
          </h1>
          <p className="mt-3 text-sm text-amber-100/80">
            Modifie les filtres ou importe un fichier Excel complet depuis la page Admin.
          </p>

          <button
            type="button"
            onClick={resetFilters}
            className="mt-6 rounded-2xl border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full max-w-full overflow-x-hidden space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
                Leaderboard
              </p>

              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Classement général de la ligue
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                Podium, classement, KPIs et évolution des victoires recalculés
                dynamiquement depuis les parties filtrées.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Badge>{rankedPlayers.length} joueurs affichés</Badge>
                <Badge>{filteredGames.length} parties analysées</Badge>
                <Badge tone="blue">{periodLabel}</Badge>

                {activeFilterCount > 0 && (
                  <Badge tone="violet">
                    {activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif
                    {activeFilterCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
              <p className="text-xs text-zinc-500">Leader actuel</p>
              <p className="mt-1 text-xl font-semibold text-white">{first.name}</p>
              <p className="mt-1 text-xs text-blue-200">
                {getMetricLabel(metric)} · {formatMetricValue(first, metric)}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-visible rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-slate-950/30 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.75)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-200/70">
                  Filtres
                </p>
              </div>

              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Périmètre du classement
              </h2>

              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Tous les blocs se recalculent depuis ce périmètre.
              </p>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white hover:text-slate-950"
            >
              Réinitialiser
            </button>
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-2 xl:grid-cols-[1.4fr_0.85fr_0.9fr_1fr_0.9fr_0.9fr]">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              minDate={gameDateBounds.minDate}
              maxDate={gameDateBounds.maxDate}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
            />

            <PremiumSelect
              label="Métrique"
              value={metric}
              options={metricOptions}
              onChange={setMetric}
            />

            <MultiSelectFilter
              label="Format"
              placeholder="Tous"
              options={playerCountOptions}
              values={playersCountFilter}
              onChange={setPlayersCountFilter}
            />

            <MultiSelectFilter
              label="Saison"
              placeholder="Toutes"
              options={seasonOptions}
              values={seasonFilter}
              onChange={setSeasonFilter}
            />

            <MultiSelectFilter
              label="Lieu"
              placeholder="Tous"
              options={locationOptions}
              values={locationFilter}
              onChange={setLocationFilter}
            />

            <MultiSelectFilter
              label="Statut"
              placeholder="Tous"
              options={statusOptions}
              values={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {(startDate || endDate) && (
                <FilterChip
                  label={`${startDate ? `Du ${formatDate(startDate)}` : "Depuis le début"} ${
                    endDate ? `au ${formatDate(endDate)}` : ""
                  }`}
                  onRemove={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                />
              )}

              {metric !== "elo" && (
                <FilterChip label={getMetricLabel(metric)} onRemove={() => setMetric("elo")} />
              )}

              {playersCountFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={`${value} joueurs`}
                  onRemove={() =>
                    setPlayersCountFilter((current) => current.filter((item) => item !== value))
                  }
                />
              ))}

              {seasonFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={getSeasonLabel(value)}
                  onRemove={() =>
                    setSeasonFilter((current) => current.filter((item) => item !== value))
                  }
                />
              ))}

              {locationFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={value}
                  onRemove={() =>
                    setLocationFilter((current) => current.filter((item) => item !== value))
                  }
                />
              ))}

              {statusFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={value}
                  onRemove={() =>
                    setStatusFilter((current) => current.filter((item) => item !== value))
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <KpiCard title="Champion" value={first.name} icon="🏆" />
          <KpiCard title="Joueur le + régulier" value={mostRegular?.name ?? "—"} icon="🎯" />
          <KpiCard title="Meilleur Win Rate" value={bestWinRate?.name ?? "—"} icon="🔥" />
          <KpiCard title="Joueur le plus actif" value={mostActive?.name ?? "—"} icon="🎮" />
          <KpiCard title="Joueur le plus dangereux" value={mostDangerous?.name ?? "—"} icon="⚔️" />
        </section>

        <section className="grid items-end gap-4 md:grid-cols-3">
          <PodiumCard player={second} variant="silver" metric={metric} />
          <PodiumCard player={first} variant="gold" metric={metric} />
          <PodiumCard player={third} variant="bronze" metric={metric} />
        </section>

        <LeaderboardResponsiveTable players={rankedPlayers} metric={metric} />

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Dynamique temporelle
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Évolution cumulative des victoires
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Cumul des victoires recalculé sur la période filtrée.
              </p>
            </div>

            <div className="w-full md:w-52">
              <PremiumSelect
                label="Affichage"
                value={chartScope}
                options={chartScopeOptions}
                onChange={setChartScope}
              />
            </div>
          </div>

          <div className="mt-6">
            <CumulativeVictoryChart data={victoryChartData} players={victoryChartPlayers} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}


function LeaderboardResponsiveTable({
  players,
  metric,
}: {
  players: RankedPlayer[];
  metric: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Classement dynamique
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Tous les joueurs
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Vue responsive sans colonnes écrasées : résumé lisible puis détails
            statistiques par joueur.
          </p>
        </div>

        <p className="text-sm text-zinc-400">
          Tri actuel :{" "}
          <span className="font-semibold text-blue-200">
            {getMetricLabel(metric)}
          </span>
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {players.map((player) => (
          <LeaderboardRow key={player.id} player={player} metric={metric} />
        ))}
      </div>
    </section>
  );
}

function LeaderboardRow({
  player,
  metric,
}: {
  player: RankedPlayer;
  metric: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition hover:border-blue-400/20 hover:bg-white/[0.035]">
      <div className="grid gap-4 p-4 lg:grid-cols-[86px_minmax(220px,1.4fr)_minmax(120px,0.72fr)_minmax(110px,0.68fr)_minmax(110px,0.68fr)_minmax(100px,0.58fr)_minmax(150px,0.85fr)] lg:items-center">
        <div>
          <p className="text-2xl font-semibold text-white">#{player.rank}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Hist. #{player.historicalRank}
          </p>
        </div>

        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">
            {player.name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Officiel #{player.officialRank} · {player.badge}
          </p>
        </div>

        <MetricBlock
          label={getMetricLabel(metric)}
          value={formatMetricValue(player, metric)}
          tone="blue"
        />

        <MetricBlock
          label="Win Rate"
          value={`${formatMaybeNumber(player.winRate)}%`}
          tone="emerald"
        />

        <MetricBlock
          label="Score moy."
          value={formatMaybeNumber(player.averageScore)}
          tone="amber"
        />

        <MetricBlock label="Parties" value={String(player.games)} tone="zinc" />

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs text-zinc-300">
            {player.status}
          </span>
          <span className="text-xs text-zinc-500">{player.lastActivity}</span>
        </div>
      </div>

      <div className="grid gap-2 border-t border-white/10 bg-white/[0.018] p-4 sm:grid-cols-2 lg:grid-cols-6">
        <DetailPill
          label="Power pondéré"
          value={formatMaybeNumber(player.weightedPowerScore)}
          tone="emerald"
        />
        <DetailPill
          label="Power Skyjo"
          value={formatMaybeNumber(player.powerScore)}
          tone="rose"
        />
        <DetailPill
          label="ELO"
          value={formatMaybeNumber(player.elo)}
          tone="blue"
        />
        <DetailPill label="Victoires" value={String(player.wins)} tone="zinc" />
        <DetailPill
          label="Régularité"
          value={formatMaybeNumber(player.regularity)}
          tone="zinc"
        />
        <DetailPill
          label="Position moy."
          value={formatMaybeNumber(player.averagePosition)}
          tone="zinc"
        />
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-orange-400/15 bg-orange-400/10 px-3 py-1 text-xs text-orange-200">
            Performance relative · {formatMaybeNumber(player.relativePerformance)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs text-zinc-400">
            Danger score · {formatMaybeNumber(player.dangerScore)}
          </span>
        </div>
      </div>
    </article>
  );
}

function MetricBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "amber" | "zinc";
}) {
  const toneClass = {
    blue: "text-blue-300",
    emerald: "text-emerald-300",
    amber: "text-orange-300",
    zinc: "text-zinc-200",
  }[tone];

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 truncate text-sm font-semibold tabular-nums ${toneClass}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function DetailPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "rose" | "zinc";
}) {
  const toneClass = {
    blue: "text-blue-200",
    emerald: "text-emerald-200",
    rose: "text-rose-200",
    zinc: "text-zinc-300",
  }[tone];

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${toneClass}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function DateRangeFilter({
  startDate,
  endDate,
  minDate,
  maxDate,
  onStartDateChange,
  onEndDateChange,
}: {
  startDate: Date | undefined;
  endDate: Date | undefined;
  minDate: Date | undefined;
  maxDate: Date | undefined;
  onStartDateChange: (value: Date | undefined) => void;
  onEndDateChange: (value: Date | undefined) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <SingleDatePicker
        label="Date début"
        value={startDate}
        initialMonth={minDate}
        minDate={minDate}
        maxDate={maxDate}
        onChange={onStartDateChange}
      />

      <SingleDatePicker
        label="Date fin"
        value={endDate}
        initialMonth={maxDate}
        minDate={minDate}
        maxDate={maxDate}
        onChange={onEndDateChange}
      />
    </div>
  );
}

function SingleDatePicker({
  label,
  value,
  initialMonth,
  minDate,
  maxDate,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  initialMonth: Date | undefined;
  minDate: Date | undefined;
  maxDate: Date | undefined;
  onChange: (value: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(value ?? initialMonth ?? new Date());
  const containerRef = useRef<HTMLDivElement | null>(null);

  useCloseOnOutsideClick(containerRef, () => setOpen(false));

  useEffect(() => {
    setVisibleMonth(clampMonth(value ?? initialMonth ?? new Date(), minDate, maxDate));
  }, [value, initialMonth, minDate, maxDate]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  const yearOptions = useMemo(() => {
    if (!minDate || !maxDate) return [new Date().getFullYear()];

    const minYear = minDate.getFullYear();
    const maxYear = maxDate.getFullYear();

    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
  }, [minDate, maxDate]);

  const monthSelectOptions = useMemo<Option[]>(() => {
    return monthOptions
      .map((month, index) => ({
        value: String(index),
        label: month,
      }))
      .filter((option) => {
        if (!minDate || !maxDate) return true;

        const monthIndex = Number(option.value);
        const year = visibleMonth.getFullYear();

        if (year === minDate.getFullYear() && monthIndex < minDate.getMonth()) return false;
        if (year === maxDate.getFullYear() && monthIndex > maxDate.getMonth()) return false;

        return true;
      });
  }, [visibleMonth, minDate, maxDate]);

  const weekDays = ["lu", "ma", "me", "je", "ve", "sa", "di"];
  const canGoPreviousMonth = !minDate || !isSameOrBeforeMonth(visibleMonth, minDate);
  const canGoNextMonth = !maxDate || !isSameOrAfterMonth(visibleMonth, maxDate);
  const canGoPreviousYear = !minDate || visibleMonth.getFullYear() > minDate.getFullYear();
  const canGoNextYear = !maxDate || visibleMonth.getFullYear() < maxDate.getFullYear();

  const updateVisibleMonth = (date: Date) => {
    setVisibleMonth(clampMonth(date, minDate, maxDate));
  };

  return (
    <div ref={containerRef} className="relative min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-2">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={!minDate || !maxDate}
        className="flex h-9 w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 text-left text-sm text-white outline-none transition hover:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? "truncate" : "truncate text-zinc-500"}>
          {value ? formatDate(value) : "Sélectionner"}
        </span>
        <span className="text-zinc-500">⌄</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[390px] rounded-[1.5rem] border border-white/10 bg-[#020617] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="mb-4 grid grid-cols-[32px_32px_110px_86px_32px_32px] items-center gap-2">
            <CalendarNavButton
              label="Année précédente"
              disabled={!canGoPreviousYear}
              onClick={() => updateVisibleMonth(addYears(visibleMonth, -1))}
            >
              «
            </CalendarNavButton>

            <CalendarNavButton
              label="Mois précédent"
              disabled={!canGoPreviousMonth}
              onClick={() => updateVisibleMonth(addMonths(visibleMonth, -1))}
            >
              ‹
            </CalendarNavButton>

            <PremiumSelectInline
              value={String(visibleMonth.getMonth())}
              options={monthSelectOptions}
              onChange={(selectedValue) =>
                updateVisibleMonth(new Date(visibleMonth.getFullYear(), Number(selectedValue), 1))
              }
            />

            <PremiumSelectInline
              value={String(visibleMonth.getFullYear())}
              options={yearOptions.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
              onChange={(selectedValue) =>
                updateVisibleMonth(new Date(Number(selectedValue), visibleMonth.getMonth(), 1))
              }
            />

            <CalendarNavButton
              label="Mois suivant"
              disabled={!canGoNextMonth}
              onClick={() => updateVisibleMonth(addMonths(visibleMonth, 1))}
            >
              ›
            </CalendarNavButton>

            <CalendarNavButton
              label="Année suivante"
              disabled={!canGoNextYear}
              onClick={() => updateVisibleMonth(addYears(visibleMonth, 1))}
            >
              »
            </CalendarNavButton>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div
                key={day}
                className="flex h-8 items-center justify-center text-[11px] font-semibold uppercase text-zinc-500"
              >
                {day}
              </div>
            ))}

            {days.map((day) => {
              const selected = value ? isSameDay(day, value) : false;
              const currentMonth = isSameMonth(day, visibleMonth);
              const disabled = isDateOutsideBounds(day, minDate, maxDate);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(startOfDay(day));
                    setOpen(false);
                  }}
                  className={[
                    "flex h-9 items-center justify-center rounded-xl text-sm transition",
                    currentMonth ? "text-zinc-200" : "text-zinc-700",
                    disabled ? "cursor-not-allowed opacity-20 hover:bg-transparent hover:text-zinc-700" : "",
                    selected
                      ? "bg-blue-500 text-white hover:bg-blue-500"
                      : "hover:bg-blue-400/10 hover:text-blue-200",
                  ].join(" ")}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="mt-4 w-full rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
          >
            Effacer
          </button>
        </div>
      )}
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

  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);

  const displayLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} sélectionnés`;

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }

    onChange([...values, value]);
  };

  return (
    <div ref={containerRef} className="relative min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-2">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 text-left text-sm text-white outline-none transition hover:border-blue-400/40"
      >
        <span className={values.length === 0 ? "truncate text-zinc-500" : "truncate"}>
          {displayLabel}
        </span>

        <span className="flex items-center gap-2">
          {values.length > 0 && (
            <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-xs font-semibold text-blue-200">
              {values.length}
            </span>
          )}
          <span className="text-zinc-500">⌄</span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.75rem)] z-40 w-full min-w-[260px] rounded-[1.25rem] border border-white/10 bg-[#020617] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <div className="max-h-72 overflow-y-auto pr-1">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-zinc-500">Aucune valeur disponible</div>
            ) : (
              options.map((option) => {
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
                          ? "border-blue-400 bg-blue-500 text-white"
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
              })
            )}
          </div>

          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
            >
              Tout effacer
            </button>
          )}
        </div>
      )}
    </div>
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

      <PremiumSelectInline value={value} options={options} onChange={onChange} />
    </div>
  );
}

function PremiumSelectInline({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useCloseOnOutsideClick(containerRef, () => setOpen(false));

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 text-left text-sm font-semibold text-white outline-none transition hover:border-blue-400/40 focus:border-blue-400/60"
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <span className="text-xs text-zinc-500">⌄</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[70] max-h-64 w-full min-w-[150px] overflow-y-auto rounded-xl border border-white/10 bg-[#020617] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                  selected
                    ? "bg-blue-500 text-white"
                    : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                ].join(" ")}
              >
                <span>{option.label}</span>
                {selected && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  player,
  variant,
  metric,
}: {
  player: RankedPlayer;
  variant: "gold" | "silver" | "bronze";
  metric: string;
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
    <div className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)] ${styles[variant]}`}>
      <div className="absolute right-[-40px] top-[-40px] h-28 w-28 rounded-full bg-white/10 blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Rang #{player.rank}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">{player.name}</h2>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-lg font-semibold text-white">
            {medals[variant]}
          </div>
        </div>

        <p className="mt-6 text-5xl font-semibold tracking-tight text-white">
          {formatMetricValue(player, metric)}
        </p>
        <p className="mt-1 text-sm text-zinc-400">{getMetricLabel(metric)}</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white">{player.badge}</p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-zinc-500">Winrate</p>
              <p className="mt-1 font-semibold text-white">{formatMaybeNumber(player.winRate)}%</p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Parties</p>
              <p className="mt-1 font-semibold text-white">{player.games}</p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Moy.</p>
              <p className="mt-1 font-semibold text-white">{formatMaybeNumber(player.averageScore)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-center text-sm font-semibold text-zinc-300">{title}</p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-4xl">{icon}</span>
        <span className="text-right text-sm font-semibold text-white">{value}</span>
      </div>
    </div>
  );
}

function CumulativeVictoryChart({
  data,
  players,
}: {
  data: VictoryChartPoint[];
  players: RankedPlayer[];
}) {
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(
    null
  );

  const width = 1120;
  const height = 360;
  const padding = { top: 24, right: 30, bottom: 48, left: 46 };

  const maxValue = Math.max(
    1,
    ...data.flatMap((point) =>
      players.map((player) => point.values[player.name] ?? 0)
    )
  );

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const x = (index: number) => {
    if (data.length <= 1) return padding.left;
    return padding.left + (index / (data.length - 1)) * plotWidth;
  };

  const y = (value: number) => {
    return padding.top + plotHeight - (value / maxValue) * plotHeight;
  };

  const gridValues = Array.from({ length: 5 }, (_, index) =>
    Math.round((maxValue / 4) * index)
  );

  const hoveredPoint =
    hoveredPointIndex !== null ? data[hoveredPointIndex] : null;

  const tooltipLeft =
    hoveredPointIndex !== null
      ? `${Math.min(82, Math.max(12, (x(hoveredPointIndex) / width) * 100))}%`
      : "50%";

  if (data.length === 0 || players.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/20 text-sm text-zinc-500">
        Aucune victoire à afficher sur cette période.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        {players.map((player) => (
          <div
            key={player.name}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getPlayerColor(player.id ?? player.name) }}
            />
            {player.name}
          </div>
        ))}
      </div>

      <div className="w-full max-w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[320px] w-full max-w-full sm:h-[360px]"
          role="img"
        >
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(value)}
                y2={y(value)}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={padding.left - 12}
                y={y(value) + 4}
                textAnchor="end"
                fontSize="11"
                fill="rgba(212,212,216,0.55)"
              >
                {value}
              </text>
            </g>
          ))}

          {players.map((player) => {
            const points = data.map((point, index) => {
              const value = point.values[player.name] ?? 0;
              return `${x(index)},${y(value)}`;
            });

            return (
              <polyline
                key={player.name}
                fill="none"
                stroke={getPlayerColor(player.id ?? player.name)}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points.join(" ")}
              />
            );
          })}

          {data.map((point, index) => {
            const shouldShow =
              data.length <= 8 ||
              index === 0 ||
              index === data.length - 1 ||
              index % Math.ceil(data.length / 6) === 0;

            if (!shouldShow) return null;

            return (
              <text
                key={point.date}
                x={x(index)}
                y={height - 14}
                textAnchor="middle"
                fontSize="11"
                fill="rgba(212,212,216,0.55)"
              >
                {point.label}
              </text>
            );
          })}

          {data.map((point, index) => {
            const hoverWidth = Math.max(
              28,
              plotWidth / Math.max(data.length, 1)
            );

            return (
              <g key={`hover-${point.date}`}>
                <rect
                  x={x(index) - hoverWidth / 2}
                  y={padding.top}
                  width={hoverWidth}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredPointIndex(index)}
                  onMouseLeave={() => setHoveredPointIndex(null)}
                />

                {hoveredPointIndex === index && (
                  <>
                    <line
                      x1={x(index)}
                      x2={x(index)}
                      y1={padding.top}
                      y2={padding.top + plotHeight}
                      stroke="rgba(255,255,255,0.22)"
                      strokeDasharray="4 4"
                    />

                    {players.map((player) => {
                      const value = point.values[player.name] ?? 0;

                      return (
                        <circle
                          key={`${point.date}-${player.name}`}
                          cx={x(index)}
                          cy={y(value)}
                          r="4"
                          fill={getPlayerColor(player.id ?? player.name)}
                          stroke="#020617"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredPoint && (
        <div
          className="pointer-events-none absolute top-24 z-50 w-[260px] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          style={{ left: tooltipLeft }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Point de passage
          </p>

          <p className="mt-1 text-sm font-semibold text-white">
            {hoveredPoint.label}
          </p>

          <div className="mt-3 space-y-2">
            {players.map((player) => (
              <div
                key={player.name}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getPlayerColor(player.id ?? player.name) }}
                  />
                  <span className="truncate text-xs text-zinc-300">
                    {player.name}
                  </span>
                </div>

                <span className="text-xs font-semibold text-white">
                  {hoveredPoint.values[player.name] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-blue-400/20"
    >
      {label} ×
    </button>
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

  return <div className={`max-w-full truncate rounded-full border px-4 py-2 text-xs font-medium ${className}`}>{children}</div>;
}

function CalendarNavButton({
  label,
  children,
  disabled = false,
  onClick,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-base text-zinc-300 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
    >
      {children}
    </button>
  );
}

function useCloseOnOutsideClick(ref: RefObject<HTMLElement | null>, onClose: () => void) {
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

function buildLeaderboard(players: Player[], games: Game[], metric: string): RankedPlayer[] {
  const playerBase = new Map<string, Player>();
  const stats = new Map<
    string,
    {
      id: string | number;
      name: string;
      scores: number[];
      positions: number[];
      wins: number;
      games: number;
      lastActivityDate: number | null;
      status: string;
      baseElo: number;
      historicalRank: number;
    }
  >();

  players.forEach((player, index) => {
    const name = getPlayerName(player);
    if (!name) return;

    playerBase.set(name, player);

    stats.set(name, {
      id: getPlayerId(player) ?? name,
      name,
      scores: [],
      positions: [],
      wins: 0,
      games: 0,
      lastActivityDate: null,
      status: player.status ?? "Officiel",
      baseElo: Number(player.elo ?? 1000),
      historicalRank: Number(player.rank ?? index + 1),
    });
  });

  const sortedGames = [...games].sort((a, b) => (getGameDateValue(a) ?? 0) - (getGameDateValue(b) ?? 0));

  sortedGames.forEach((game) => {
    const gameDateValue = getGameDateValue(game);
    const results = Array.isArray(game.results) ? game.results : [];
    const normalizedResults = results.map((result) => normalizeResult(result)).filter((result) => result.name);

    if (normalizedResults.length === 0) return;

    const winnerNames = getWinnerNames(normalizedResults);

    normalizedResults.forEach((result) => {
      const name = result.name;
      const basePlayer = playerBase.get(name);

      if (!stats.has(name)) {
        stats.set(name, {
          id: result.playerId ?? name,
          name,
          scores: [],
          positions: [],
          wins: 0,
          games: 0,
          lastActivityDate: null,
          status: "Nouveau",
          baseElo: 1000,
          historicalRank: stats.size + 1,
        });
      }

      const row = stats.get(name);
      if (!row) return;

      row.games += 1;

      if (isFiniteNumber(result.score)) row.scores.push(result.score);
      if (isFiniteNumber(result.position)) row.positions.push(result.position);
      if (winnerNames.includes(name)) row.wins += 1;

      if (gameDateValue !== null) {
        row.lastActivityDate =
          row.lastActivityDate === null ? gameDateValue : Math.max(row.lastActivityDate, gameDateValue);
      }

      if (basePlayer?.status) row.status = basePlayer.status;
    });
  });

  const averagePlayers = gameAveragePlayers(games);

  const rows = Array.from(stats.values()).map((row) => {
    const basePlayer = playerBase.get(row.name);

    const averageScore =
      row.scores.length > 0 ? average(row.scores) : Number(basePlayer?.avgScore ?? basePlayer?.averageScore ?? 0);

    const averagePosition =
      row.positions.length > 0 ? average(row.positions) : basePlayer?.averagePosition;

    const regularity = row.scores.length > 1 ? standardDeviation(row.scores) : basePlayer?.regularity;

    const winRate = row.games > 0 ? (row.wins / row.games) * 100 : Number(basePlayer?.winRate ?? 0);

    const scorePerformance = Math.max(0, 100 - averageScore * 3);
    const regularityPerformance = regularity !== undefined ? Math.max(0, 100 - regularity * 5) : 50;
    const powerScore = winRate * 0.5 + scorePerformance * 0.3 + regularityPerformance * 0.2;
    const activityWeight = Math.min(1, row.games / 10);
    const weightedPowerScore = powerScore * (0.65 + activityWeight * 0.35);

    const elo =
      row.games > 0
        ? 1000 +
          row.wins * 18 +
          winRate * 1.2 -
          averageScore * 1.5 -
          (averagePosition ?? 3) * 4 +
          row.games * 2
        : row.baseElo;

    const relativePerformance =
      averagePosition && averagePlayers > 0
        ? ((averagePlayers - averagePosition) / averagePlayers) * 100
        : basePlayer?.relativePerformance;

    const dangerScore = winRate * 0.6 + Math.max(0, 30 - averageScore) * 1.4 + row.games * 0.08;
    const status = inferPlayerStatus(row.status, row.games, row.lastActivityDate);

    const player: RankedPlayer = {
      id: row.id,
      name: row.name,
      rank: 0,
      historicalRank: row.historicalRank,
      officialRank: 0,
      elo,
      winRate,
      games: row.games,
      averageScore,
      wins: row.wins,
      regularity,
      averagePosition,
      relativePerformance,
      weightedPowerScore,
      powerScore,
      status,
      lastActivity: formatLastActivity(row.lastActivityDate),
      lastActivityDate: row.lastActivityDate,
      badge: getPlayerBadge(status, row.games, winRate),
      dangerScore,
      sortValue: 0,
    };

    return {
      ...player,
      sortValue: getMetricValue(player, metric),
    };
  });

  return rows
    .filter((player) => player.games > 0)
    .sort((a, b) => b.sortValue - a.sortValue)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
      officialRank: index + 1,
    }));
}

function buildCumulativeVictoryData(games: Game[], players: RankedPlayer[]): VictoryChartPoint[] {
  const selectedNames = new Set(players.map((player) => player.name));
  const counters = new Map(players.map((player) => [player.name, 0]));
  const grouped = new Map<string, Game[]>();

  [...games]
    .sort((a, b) => (getGameDateValue(a) ?? 0) - (getGameDateValue(b) ?? 0))
    .forEach((game) => {
      const timestamp = getGameDateValue(game);
      if (timestamp === null) return;

      const key = format(new Date(timestamp), "yyyy-MM-dd");
      grouped.set(key, [...(grouped.get(key) ?? []), game]);
    });

  return Array.from(grouped.entries()).map(([dateKey, dayGames]) => {
    dayGames.forEach((game) => {
      const results = Array.isArray(game.results) ? game.results : [];
      const normalizedResults = results.map((result) => normalizeResult(result)).filter((result) => result.name);
      const winnerNames = getWinnerNames(normalizedResults);

      winnerNames.forEach((name) => {
        if (!selectedNames.has(name)) return;
        counters.set(name, (counters.get(name) ?? 0) + 1);
      });
    });

    return {
      date: dateKey,
      label: format(new Date(dateKey), "dd/MM", { locale: fr }),
      values: Object.fromEntries(counters),
    };
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

  const playerId = result.JoueurID ?? result.joueurID;

  const score = toNumber(result.score ?? result.Score);

  const position = toNumber(result.position ?? result.Position ?? result.rank ?? result.Rang);

  const isWinner =
    result.isWinner === true ||
    result.winner === true ||
    result.win === true ||
    result.victoire === true ||
    position === 1;

  return {
    name: name ? String(name) : "",
    playerId,
    score,
    position,
    isWinner,
  };
}

function getWinnerNames(results: NormalizedResult[]) {
  const explicitWinners = results.filter((result) => result.isWinner).map((result) => result.name);
  if (explicitWinners.length > 0) return explicitWinners;

  const positioned = results.filter((result) => isFiniteNumber(result.position));
  if (positioned.length > 0) {
    const bestPosition = Math.min(...positioned.map((result) => result.position as number));
    return positioned.filter((result) => result.position === bestPosition).map((result) => result.name);
  }

  const scored = results.filter((result) => isFiniteNumber(result.score));
  if (scored.length > 0) {
    const bestScore = Math.min(...scored.map((result) => result.score as number));
    return scored.filter((result) => result.score === bestScore).map((result) => result.name);
  }

  return [];
}

function getMetricValue(player: RankedPlayer, metric: string) {
  if (metric === "winRate") return player.winRate;
  if (metric === "averageScore") return -player.averageScore;
  if (metric === "games") return player.games;
  if (metric === "powerScore") return player.powerScore;
  if (metric === "powerScoreWeighted") return player.weightedPowerScore;
  return player.elo;
}

function getMetricLabel(metric: string) {
  return metricOptions.find((option) => option.value === metric)?.label ?? metric;
}

function formatMetricValue(player: RankedPlayer, metric: string) {
  const value = getMetricValue(player, metric);

  if (metric === "winRate") return `${formatMaybeNumber(player.winRate)}%`;
  if (metric === "games") return String(player.games);
  if (metric === "averageScore") return formatMaybeNumber(player.averageScore);

  return formatMaybeNumber(value);
}

function getPlayerBadge(status: string, games: number, winRate: number) {
  if (status === "Nouveau") return "Nouveau joueur";
  if (status === "Inactif") return "À surveiller";
  if (games >= 10 && winRate >= 50) return "Prétendant sérieux";
  if (games >= 10) return "Joueur confirmé";
  return "Joueur actif";
}

function inferPlayerStatus(baseStatus: string, games: number, lastActivityDate: number | null) {
  if (games <= 2) return "Nouveau";
  if (!lastActivityDate) return baseStatus || "Officiel";

  const days = Math.floor(
    (startOfDay(new Date()).getTime() - startOfDay(new Date(lastActivityDate)).getTime()) / 86_400_000
  );

  if (days >= 30) return "Inactif";
  return baseStatus || "Officiel";
}

function formatLastActivity(timestamp: number | null) {
  if (!timestamp) return "—";

  const today = startOfDay(new Date()).getTime();
  const date = startOfDay(new Date(timestamp)).getTime();
  const diffDays = Math.floor((today - date) / 86_400_000);

  if (diffDays <= 0) return "Aujourd’hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 14) return "Il y a 1 semaine";
  if (diffDays < 31) return `Il y a ${Math.floor(diffDays / 7)} semaines`;

  return `Inactif depuis ${diffDays} jours`;
}

function gameAveragePlayers(games: Game[]) {
  const values = games.map((game) => getGamePlayersCount(game)).filter((value): value is number => isFiniteNumber(value));

  if (values.length === 0) return 0;
  return average(values);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) return 0;

  const avg = average(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;

  return Math.sqrt(variance);
}

const PLAYER_COLOR_PALETTE = [
  "#38bdf8",
  "#f59e0b",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#60a5fa",
  "#f97316",
  "#22c55e",
  "#e879f9",
  "#facc15",
  "#2dd4bf",
  "#c084fc",
  "#f43f5e",
  "#84cc16",
  "#06b6d4",
  "#fb923c",
  "#818cf8",
  "#10b981",
  "#f472b6",
  "#eab308",
  "#14b8a6",
  "#8b5cf6",
  "#ef4444",
  "#3b82f6",
];

function getPlayerColor(playerKey: string | number) {
  const normalizedKey = String(playerKey)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  let hash = 0;

  for (let index = 0; index < normalizedKey.length; index += 1) {
    hash = normalizedKey.charCodeAt(index) + ((hash << 5) - hash);
    hash |= 0;
  }

  return PLAYER_COLOR_PALETTE[Math.abs(hash) % PLAYER_COLOR_PALETTE.length];
}

function getPlayerName(player: Player) {
  return player.name ?? player.Nom ?? player.nom ?? "";
}

function getPlayerId(player: Player) {
  return player.id ?? player.JoueurID ?? player.joueurID;
}

function getGamePlayersCount(game: Game) {
  return toNumber(game.players ?? game.NbJoueurs ?? game.nbJoueurs);
}

function getGameLocation(game: Game) {
  return game.lieu ?? game.Lieu ?? "";
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
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

function isDateOutsideBounds(date: Date, minDate: Date | undefined, maxDate: Date | undefined) {
  if (minDate && isBefore(startOfDay(date), startOfDay(minDate))) return true;
  if (maxDate && isAfter(startOfDay(date), startOfDay(maxDate))) return true;
  return false;
}

function isSameOrBeforeMonth(date: Date, compareDate: Date) {
  return startOfMonth(date).getTime() <= startOfMonth(compareDate).getTime();
}

function isSameOrAfterMonth(date: Date, compareDate: Date) {
  return startOfMonth(date).getTime() >= startOfMonth(compareDate).getTime();
}

function clampMonth(date: Date, minDate: Date | undefined, maxDate: Date | undefined) {
  if (minDate && isBefore(startOfMonth(date), startOfMonth(minDate))) return startOfMonth(minDate);
  if (maxDate && isAfter(startOfMonth(date), startOfMonth(maxDate))) return startOfMonth(maxDate);
  return startOfMonth(date);
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

  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day).getTime();
}

function excelSerialDateToTimestamp(serial: number) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86_400_000;
  const date = new Date(utcValue);

  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).getTime();
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

function getSeasonSortValue(season: string) {
  const value = Number(season.replace("S", ""));
  return Number.isFinite(value) ? value : 999;
}

function getSeasonLabel(season: string) {
  if (season === "S00") return "S00 · Avant avril 2026";

  const seasonNumber = Number(season.replace("S", ""));
  if (!Number.isFinite(seasonNumber)) return season;

  const startMonthIndex = 3 + (seasonNumber - 1) * 3;
  const startDate = new Date(2026, startMonthIndex, 1);
  const endDate = new Date(2026, startMonthIndex + 3, 0);

  return `${season} · ${format(startDate, "MMM yyyy", { locale: fr })} - ${format(endDate, "MMM yyyy", { locale: fr })}`;
}

function getPeriodLabel(games: Game[]) {
  const dates = games.map((game) => getGameDateValue(game)).filter((value): value is number => isFiniteNumber(value));

  if (dates.length === 0) return "Aucune période";

  return `${formatDate(new Date(Math.min(...dates)))} - ${formatDate(new Date(Math.max(...dates)))}`;
}

function formatDate(date: Date) {
  return format(date, "dd/MM/yyyy", { locale: fr });
}

function formatMaybeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value.toFixed(2).replace(".", ",");
}
