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
  id: string | number;
  rank?: number;
  name: string;
  elo?: number;
  winRate?: number;
  games?: number;
  avgScore?: number;
  averageScore?: number;
  form?: string;
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
  date?: string;
  dateTimestamp?: number;
  players?: number;
  season?: string;
  saison?: string;
  results?: any[];
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

export default function LeaderboardPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });
  const { data, loading } = useSkyjoData();

  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [playersCountFilter, setPlayersCountFilter] = useState<string[]>([]);
  const [seasonFilter, setSeasonFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [metric, setMetric] = useState("elo");

  const players = (data?.players ?? []) as Player[];
  const games = (data?.games ?? []) as Game[];

  const gameDateBounds = useMemo(() => {
    const timestamps: number[] = games.reduce((acc: number[], game: Game) => {
      const value = getGameDateValue(game);

      if (typeof value === "number" && Number.isFinite(value)) {
        acc.push(value);
      }

      return acc;
    }, []);

    if (timestamps.length === 0) {
      return {
        minDate: undefined,
        maxDate: undefined,
      };
    }

    return {
      minDate: startOfDay(new Date(Math.min(...timestamps))),
      maxDate: startOfDay(new Date(Math.max(...timestamps))),
    };
  }, [games]);

  const playerCountOptions = useMemo<Option[]>(() => {
    return Array.from(
      new Set<number>(
        games
          .map((game) => Number(game.players))
          .filter((value) => Number.isFinite(value))
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
      new Set<string>(
        games
          .map((game) => getGameSeason(game))
          .filter(isNonEmptyString)
      )
    )
      .sort((a, b) => getSeasonSortValue(a) - getSeasonSortValue(b))
      .map((season) => ({
        value: season,
        label: getSeasonLabel(season),
      }));
  }, [games]);

  const statusOptions = useMemo<Option[]>(() => {
    const values = players
      .map((player) => String(player.status ?? "Officiel").trim())
      .filter(isNonEmptyString);

    return Array.from(new Set<string>(values))
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((status) => ({
        value: status,
        label: status,
      }));
  }, [players]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const gameDateValue = getGameDateValue(game);
      const startValue = startDate ? startOfDay(startDate).getTime() : null;
      const endValue = endDate ? endOfDay(endDate).getTime() : null;
      const gameSeason = getGameSeason(game);
      const gamePlayers = String(Number(game.players));

      if (
        startValue !== null &&
        gameDateValue !== null &&
        gameDateValue < startValue
      ) {
        return false;
      }

      if (
        endValue !== null &&
        gameDateValue !== null &&
        gameDateValue > endValue
      ) {
        return false;
      }

      if (
        playersCountFilter.length > 0 &&
        !playersCountFilter.includes(gamePlayers)
      ) {
        return false;
      }

      if (
        seasonFilter.length > 0 &&
        gameSeason !== null &&
        !seasonFilter.includes(gameSeason)
      ) {
        return false;
      }

      if (seasonFilter.length > 0 && gameSeason === null) {
        return false;
      }

      return true;
    });
  }, [games, startDate, endDate, playersCountFilter, seasonFilter]);

  const rankedPlayers = useMemo(() => {
    return buildLeaderboard(players, filteredGames, metric).filter((player) => {
      if (statusFilter.length === 0) {
        return true;
      }

      return statusFilter.includes(player.status);
    });
  }, [players, filteredGames, metric, statusFilter]);

  const first = rankedPlayers[0];
  const second = rankedPlayers[1];
  const third = rankedPlayers[2];

  const mostRegular = [...rankedPlayers]
    .filter((player) => Number.isFinite(player.regularity))
    .sort((a, b) => (a.regularity ?? 999) - (b.regularity ?? 999))[0];

  const bestWinRate = [...rankedPlayers].sort(
    (a, b) => b.winRate - a.winRate
  )[0];

  const mostActive = [...rankedPlayers].sort((a, b) => b.games - a.games)[0];

  const mostDangerous = [...rankedPlayers].sort(
    (a, b) => b.dangerScore - a.dangerScore
  )[0];

  const activeFilterCount =
    (startDate || endDate ? 1 : 0) +
    playersCountFilter.length +
    seasonFilter.length +
    statusFilter.length +
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

          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
                Leaderboard
              </p>

              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Classement général de la ligue
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
                Suivi global du leaderboard : podium, Elo, winrate, régularité
                et dynamique des joueurs Skyjo Seenovate.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Badge>{rankedPlayers.length} joueurs affichés</Badge>
                <Badge>{filteredGames.length} parties analysées</Badge>
                <Badge tone="blue">{periodLabel}</Badge>

                {activeFilterCount > 0 && (
                  <Badge tone="violet">
                    {activeFilterCount} filtre
                    {activeFilterCount > 1 ? "s" : ""} actif
                    {activeFilterCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4">
              <p className="text-xs text-zinc-500">Leader actuel</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {first.name}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Filtres
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-white">
                Périmètre du classement
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Filtre la période, les formats de partie, les saisons et les
                statuts. La métrique choisie pilote le tri du classement.
              </p>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white hover:text-slate-950"
            >
              Réinitialiser
            </button>
          </div>

          <div className="mt-7 grid gap-3 xl:grid-cols-[1.35fr_1fr_1fr_1fr_1fr]">
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
              label="Nombre de joueurs"
              placeholder="Tous les formats"
              options={playerCountOptions}
              values={playersCountFilter}
              onChange={setPlayersCountFilter}
            />

            <MultiSelectFilter
              label="Saisons"
              placeholder="Toutes les saisons"
              options={seasonOptions}
              values={seasonFilter}
              onChange={setSeasonFilter}
            />

            <MultiSelectFilter
              label="Statut"
              placeholder="Tous les statuts"
              options={statusOptions}
              values={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {(startDate || endDate) && (
                <FilterChip
                  label={`${
                    startDate ? `Du ${formatDate(startDate)}` : "Depuis le début"
                  } ${endDate ? `au ${formatDate(endDate)}` : ""}`}
                  onRemove={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                />
              )}

              {metric !== "elo" && (
                <FilterChip
                  label={
                    metricOptions.find((option) => option.value === metric)
                      ?.label ?? metric
                  }
                  onRemove={() => setMetric("elo")}
                />
              )}

              {playersCountFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={`${value} joueurs`}
                  onRemove={() =>
                    setPlayersCountFilter((current) =>
                      current.filter((item) => item !== value)
                    )
                  }
                />
              ))}

              {seasonFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={getSeasonLabel(value)}
                  onRemove={() =>
                    setSeasonFilter((current) =>
                      current.filter((item) => item !== value)
                    )
                  }
                />
              ))}

              {statusFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={value}
                  onRemove={() =>
                    setStatusFilter((current) =>
                      current.filter((item) => item !== value)
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <KpiCard title="Champion" value={first.name} icon="🏆" />
          <KpiCard
            title="Joueur le + régulier"
            value={mostRegular?.name ?? "—"}
            icon="🎯"
          />
          <KpiCard
            title="Meilleur Win Rate"
            value={bestWinRate?.name ?? "—"}
            icon="🔥"
          />
          <KpiCard
            title="Joueur le plus actif"
            value={mostActive?.name ?? "—"}
            icon="🎮"
          />
          <KpiCard
            title="Joueur le plus dangereux"
            value={mostDangerous?.name ?? "—"}
            icon="⚔️"
          />
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
                Classement dynamique
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Tous les joueurs
              </h2>
            </div>

            <p className="text-sm text-zinc-400">
              Données issues du fichier Excel importé.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1500px] text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-4 py-4">Rang historique</th>
                  <th className="px-4 py-4">Rang officiel</th>
                  <th className="px-4 py-4">Joueur</th>
                  <th className="px-4 py-4">Power Score Skyjo Pondérée</th>
                  <th className="px-4 py-4">Power Score Skyjo</th>
                  <th className="px-4 py-4">ELO</th>
                  <th className="px-4 py-4">Win Rate</th>
                  <th className="px-4 py-4">Score moyen</th>
                  <th className="px-4 py-4">Victoires</th>
                  <th className="px-4 py-4">Régularité</th>
                  <th className="px-4 py-4">Position moyenne</th>
                  <th className="px-4 py-4">Performance relative</th>
                  <th className="px-4 py-4">Parties Total</th>
                  <th className="px-4 py-4">Statut Joueur</th>
                  <th className="px-4 py-4">Dernière Activité</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {rankedPlayers.map((player) => (
                  <tr
                    key={player.id}
                    className="bg-black/10 transition hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-4 text-zinc-400">#{player.rank}</td>
                    <td className="px-4 py-4 text-zinc-400">#{player.rank}</td>
                    <td className="px-4 py-4 font-medium text-white">
                      {player.name}
                    </td>
                    <td className="px-4 py-4 text-emerald-300">
                      {formatMaybeNumber(player.weightedPowerScore)}
                    </td>
                    <td className="px-4 py-4 text-red-300">
                      {formatMaybeNumber(player.powerScore)}
                    </td>
                    <td className="px-4 py-4 text-blue-300">{player.elo}</td>
                    <td className="px-4 py-4 text-emerald-300">
                      {player.winRate}%
                    </td>
                    <td className="px-4 py-4 text-orange-300">
                      {player.averageScore}
                    </td>
                    <td className="px-4 py-4 text-zinc-300">{player.wins}</td>
                    <td className="px-4 py-4 text-zinc-300">
                      {formatMaybeNumber(player.regularity)}
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      {formatMaybeNumber(player.averagePosition)}
                    </td>
                    <td className="px-4 py-4 text-orange-300">
                      {formatMaybeNumber(player.relativePerformance)}
                    </td>
                    <td className="px-4 py-4 text-zinc-300">{player.games}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
                        {player.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      {player.lastActivity}
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
    <div className="grid gap-3 sm:grid-cols-2">
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
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    value ?? initialMonth ?? new Date()
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useCloseOnOutsideClick(containerRef, () => setOpen(false));

  useEffect(() => {
    setVisibleMonth(
      clampMonth(value ?? initialMonth ?? new Date(), minDate, maxDate)
    );
  }, [value, initialMonth, minDate, maxDate]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });

    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  const yearOptions = useMemo(() => {
    if (!minDate || !maxDate) {
      return [new Date().getFullYear()];
    }

    const minYear = minDate.getFullYear();
    const maxYear = maxDate.getFullYear();

    return Array.from(
      { length: maxYear - minYear + 1 },
      (_, index) => minYear + index
    );
  }, [minDate, maxDate]);

  const monthSelectOptions = useMemo<Option[]>(() => {
    return monthOptions
      .map((month, index) => ({
        value: String(index),
        label: month,
      }))
      .filter((option) => {
        if (!minDate || !maxDate) {
          return true;
        }

        const monthIndex = Number(option.value);
        const year = visibleMonth.getFullYear();

        if (year === minDate.getFullYear() && monthIndex < minDate.getMonth()) {
          return false;
        }

        if (year === maxDate.getFullYear() && monthIndex > maxDate.getMonth()) {
          return false;
        }

        return true;
      });
  }, [visibleMonth, minDate, maxDate]);

  const weekDays = ["lu", "ma", "me", "je", "ve", "sa", "di"];

  const canGoPreviousMonth =
    !minDate || !isSameOrBeforeMonth(visibleMonth, minDate);
  const canGoNextMonth =
    !maxDate || !isSameOrAfterMonth(visibleMonth, maxDate);
  const canGoPreviousYear =
    !minDate || visibleMonth.getFullYear() > minDate.getFullYear();
  const canGoNextYear =
    !maxDate || visibleMonth.getFullYear() < maxDate.getFullYear();

  const updateVisibleMonth = (date: Date) => {
    setVisibleMonth(clampMonth(date, minDate, maxDate));
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-white/10 bg-black/20 p-3"
    >
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={!minDate || !maxDate}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-left text-sm text-white outline-none transition hover:border-blue-400/40 disabled:cursor-not-allowed disabled:opacity-50"
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
                updateVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    Number(selectedValue),
                    1
                  )
                )
              }
            />

            <PremiumSelectInline
              value={String(visibleMonth.getFullYear())}
              options={yearOptions.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
              onChange={(selectedValue) =>
                updateVisibleMonth(
                  new Date(
                    Number(selectedValue),
                    visibleMonth.getMonth(),
                    1
                  )
                )
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
                    disabled
                      ? "cursor-not-allowed opacity-20 hover:bg-transparent hover:text-zinc-700"
                      : "",
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

  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

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
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-white/10 bg-black/20 p-3"
    >
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-left text-sm text-white outline-none transition hover:border-blue-400/40"
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
              <div className="px-3 py-3 text-sm text-zinc-500">
                Aucune valeur disponible
              </div>
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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
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
        className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-left text-sm font-semibold text-white outline-none transition hover:border-blue-400/40 focus:border-blue-400/60"
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
}: {
  player: any;
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
                {player.averageScore}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-center text-sm font-semibold text-zinc-300">{title}</p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-4xl">{icon}</span>
        <span className="text-right text-sm font-semibold text-white">
          {value}
        </span>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
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

  return (
    <div
      className={`max-w-full truncate rounded-full border px-4 py-2 text-xs font-medium ${className}`}
    >
      {children}
    </div>
  );
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

function useCloseOnOutsideClick(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    const handleClick = (event: MouseEvent | TouchEvent) => {
      const element = ref.current;

      if (!element) {
        return;
      }

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

function buildLeaderboard(players: Player[], games: Game[], metric: string) {
  const stats = new Map<string, any>();

  players.forEach((player, index) => {
    stats.set(String(player.name), {
      id: player.id ?? player.name,
      name: player.name,
      elo: Number(player.elo ?? 1000),
      winRate: Number(player.winRate ?? 0),
      games: Number(player.games ?? 0),
      averageScore: Number(player.avgScore ?? player.averageScore ?? 0),
      wins: Number(player.wins ?? 0),
      regularity: player.regularity,
      averagePosition: player.averagePosition,
      relativePerformance: player.relativePerformance,
      weightedPowerScore: undefined,
      powerScore: undefined,
      status: player.status ?? "Officiel",
      lastActivity: player.lastActivity ?? "—",
      badge: player.badge ?? "Joueur actif",
      rank: index + 1,
      dangerScore: 0,
    });
  });

  games.forEach((game) => {
    const results = Array.isArray(game.results) ? game.results : [];

    results.forEach((result: any) => {
      const name =
        result.playerName ??
        result.name ??
        result.player ??
        result.nom ??
        result.NOM;

      if (!name) {
        return;
      }

      if (!stats.has(String(name))) {
        stats.set(String(name), {
          id: String(name),
          name: String(name),
          elo: 1000,
          winRate: 0,
          games: 0,
          averageScore: 0,
          wins: 0,
          status: "Nouveau",
          lastActivity: "—",
          badge: "Joueur actif",
          dangerScore: 0,
        });
      }
    });
  });

  const rows = Array.from(stats.values()).map((player) => {
    const dangerScore =
      Number(player.winRate ?? 0) * 0.6 +
      Math.max(0, 30 - Number(player.averageScore ?? 0)) * 1.4 +
      Number(player.games ?? 0) * 0.08;

    return {
      ...player,
      dangerScore,
      sortValue: getMetricValue(player, metric),
    };
  });

  return rows
    .sort((a, b) => b.sortValue - a.sortValue)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
}

function getMetricValue(player: any, metric: string) {
  if (metric === "winRate") return Number(player.winRate ?? 0);
  if (metric === "averageScore") return -Number(player.averageScore ?? 0);
  if (metric === "games") return Number(player.games ?? 0);
  if (metric === "powerScore") return Number(player.powerScore ?? player.elo ?? 0);
  if (metric === "powerScoreWeighted") {
    return Number(player.weightedPowerScore ?? player.elo ?? 0);
  }

  return Number(player.elo ?? 0);
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isDateOutsideBounds(
  date: Date,
  minDate: Date | undefined,
  maxDate: Date | undefined
) {
  if (minDate && isBefore(startOfDay(date), startOfDay(minDate))) {
    return true;
  }

  if (maxDate && isAfter(startOfDay(date), startOfDay(maxDate))) {
    return true;
  }

  return false;
}

function isSameOrBeforeMonth(date: Date, compareDate: Date) {
  return startOfMonth(date).getTime() <= startOfMonth(compareDate).getTime();
}

function isSameOrAfterMonth(date: Date, compareDate: Date) {
  return startOfMonth(date).getTime() >= startOfMonth(compareDate).getTime();
}

function clampMonth(
  date: Date,
  minDate: Date | undefined,
  maxDate: Date | undefined
) {
  if (minDate && isBefore(startOfMonth(date), startOfMonth(minDate))) {
    return startOfMonth(minDate);
  }

  if (maxDate && isAfter(startOfMonth(date), startOfMonth(maxDate))) {
    return startOfMonth(maxDate);
  }

  return startOfMonth(date);
}

function getGameDateValue(game: Game) {
  if (game.dateTimestamp) {
    const timestamp = Number(game.dateTimestamp);
    return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  }

  if (!game.date) return null;

  const value = String(game.date);

  if (value.includes("-")) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const [day, month, year] = value.split("/").map(Number);

  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day).getTime();
}

function getGameSeason(game: Game) {
  const timestamp = getGameDateValue(game);

  if (timestamp === null) return null;

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (year < 2026 || (year === 2026 && month < 4)) {
    return "S00";
  }

  const monthsSinceApril2026 = (year - 2026) * 12 + (month - 4);
  const seasonIndex = Math.floor(monthsSinceApril2026 / 3) + 1;

  return `S${String(seasonIndex).padStart(2, "0")}`;
}

function getSeasonSortValue(season: string) {
  const value = Number(season.replace("S", ""));
  return Number.isFinite(value) ? value : 999;
}

function getSeasonLabel(season: string) {
  if (season === "S00") {
    return "S00 · Avant avril 2026";
  }

  const seasonNumber = Number(season.replace("S", ""));

  if (!Number.isFinite(seasonNumber)) {
    return season;
  }

  const startMonthIndex = 3 + (seasonNumber - 1) * 3;
  const startDate = new Date(2026, startMonthIndex, 1);
  const endDate = new Date(2026, startMonthIndex + 3, 0);

  return `${season} · ${format(startDate, "MMM yyyy", {
    locale: fr,
  })} - ${format(endDate, "MMM yyyy", { locale: fr })}`;
}

function getPeriodLabel(games: Game[]) {
  const dates = games
    .map((game) => getGameDateValue(game))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (dates.length === 0) {
    return "Aucune période";
  }

  return `${formatDate(new Date(Math.min(...dates)))} - ${formatDate(
    new Date(Math.max(...dates))
  )}`;
}

function formatDate(date: Date) {
  return format(date, "dd/MM/yyyy", { locale: fr });
}

function formatMaybeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(2).replace(".", ",");
}