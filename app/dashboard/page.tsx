"use client";

import Link from "next/link";
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
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";
import ActivityChart from "@/components/charts/ActivityChart";
import PlayersPerGameChart from "@/components/charts/PlayersPerGameChart";
import CompetitivePositionChart from "@/components/charts/CompetitivePositionChart";
import ScoreDistributionChart from "@/components/charts/ScoreDistributionChart";

type Option = {
  value: string;
  label: string;
};

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

export default function DashboardPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });
  const { data, loading } = useSkyjoData();

  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [playersFilter, setPlayersFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [seasonFilter, setSeasonFilter] = useState<string[]>([]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email);
    };

    getUser();
  }, []);

  const players = data?.players ?? [];
  const games = data?.games ?? [];
  const rivalries = data?.rivalries ?? [];

  const gameDateBounds = useMemo(() => {
    const timestamps: number[] = games.reduce((acc: number[], game: any) => {
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
          .map((game: any) => Number(game.players))
          .filter((value: number) => Number.isFinite(value))
      )
    )
      .sort((a, b) => a - b)
      .map((count) => ({
        value: String(count),
        label: `${count} joueurs`,
      }));
  }, [games]);

  const locationOptions = useMemo<Option[]>(() => {
    const locations = games
      .map((game: any): string =>
        String(game.location ?? game.lieu ?? game.place ?? "").trim()
      )
      .filter(isNonEmptyString);

    return Array.from(new Set<string>(locations))
      .sort((a, b) => a.localeCompare(b, "fr"))
      .map((location) => ({
        value: location,
        label: location,
      }));
  }, [games]);

  const seasonOptions = useMemo<Option[]>(() => {
    const seasons = games
      .map((game: any): string | null => getGameSeason(game))
      .filter(isNonEmptyString);

    return Array.from(new Set<string>(seasons))
      .sort((a, b) => getSeasonSortValue(a) - getSeasonSortValue(b))
      .map((season) => ({
        value: season,
        label: getSeasonLabel(season),
      }));
  }, [games]);

  const activeFilterCount =
    (startDate || endDate ? 1 : 0) +
    playersFilter.length +
    locationFilter.length +
    seasonFilter.length;

  const filteredGames = useMemo(() => {
    return games.filter((game: any) => {
      const gameDateValue = getGameDateValue(game);
      const gameSeason = getGameSeason(game);

      const startValue = startDate ? startOfDay(startDate).getTime() : null;
      const endValue = endDate ? endOfDay(endDate).getTime() : null;

      const gamePlayers = String(Number(game.players));
      const gameLocation = String(
        game.location ?? game.lieu ?? game.place ?? ""
      ).trim();

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

      if (playersFilter.length > 0 && !playersFilter.includes(gamePlayers)) {
        return false;
      }

      if (locationFilter.length > 0 && !locationFilter.includes(gameLocation)) {
        return false;
      }

      if (seasonFilter.length > 0 && gameSeason === null) {
        return false;
      }

      if (
        seasonFilter.length > 0 &&
        gameSeason !== null &&
        !seasonFilter.includes(gameSeason)
      ) {
        return false;
      }

      return true;
    });
  }, [games, startDate, endDate, playersFilter, locationFilter, seasonFilter]);

  const filteredPlayers = useMemo(() => {
    if (filteredGames.length === games.length) {
      return players;
    }

    const playerStats = new Map<string, any>();

    filteredGames.forEach((game: any) => {
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

        if (!playerStats.has(name)) {
          const basePlayer =
            players.find((player: any) => player.name === name) ?? {};

          playerStats.set(name, {
            ...basePlayer,
            id: basePlayer.id ?? name,
            name,
            games: 0,
            totalScore: 0,
            wins: 0,
            elo: basePlayer.elo ?? 0,
            rank: basePlayer.rank ?? 0,
          });
        }

        const entry = playerStats.get(name);
        const score = Number(result.score);

        entry.games += 1;

        if (Number.isFinite(score)) {
          entry.totalScore += score;
        }

        if (
          game.winner === name ||
          result.position === 1 ||
          result.rank === 1
        ) {
          entry.wins += 1;
        }
      });
    });

    return Array.from(playerStats.values())
      .map((player: any) => ({
        ...player,
        averageScore:
          player.games > 0
            ? Number((player.totalScore / player.games).toFixed(2))
            : 0,
        winRate:
          player.games > 0
            ? Math.round((player.wins / player.games) * 100)
            : 0,
      }))
      .sort((a: any, b: any) => {
        if (b.winRate !== a.winRate) {
          return b.winRate - a.winRate;
        }

        return a.averageScore - b.averageScore;
      })
      .map((player: any, index: number) => ({
        ...player,
        rank: index + 1,
      }));
  }, [filteredGames, games.length, players]);

  const filteredRivalries = rivalries;
  const champion = filteredPlayers[0];
  const hotRivalry = filteredRivalries[0];

  const bestScores = filteredGames
    .map((game: any) => Number(game.bestScore))
    .filter((value: number) => Number.isFinite(value));

  const worstScores = filteredGames
    .map((game: any) => Number(game.worstScore))
    .filter((value: number) => Number.isFinite(value));

  const bestScore = bestScores.length > 0 ? Math.min(...bestScores) : 0;
  const worstScore = worstScores.length > 0 ? Math.max(...worstScores) : 0;

  const averageScore =
    bestScores.length > 0
      ? Math.round(
          bestScores.reduce((sum: number, score: number) => sum + score, 0) /
            bestScores.length
        )
      : 0;

  const gamesPerDay = getGamesPerDay(filteredGames);
  const lastGameDate = getLastGameDate(games);

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
    setPlayersFilter([]);
    setLocationFilter([]);
    setSeasonFilter([]);
  };

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-[#020617] text-white">
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

  return (
    <AppShell userEmail={userEmail}>
      <div className="w-full max-w-full overflow-x-hidden space-y-8 sm:space-y-10">
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
                Synthèse de la saison active : classement, dynamique des
                joueurs, dernières parties et rivalités majeures.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Badge>Supabase live</Badge>

                <Badge>
                  {filteredGames.length} / {games.length} parties affichées
                </Badge>

                {lastGameDate && (
                  <Badge tone="blue">Données à jour au {lastGameDate}</Badge>
                )}

                {activeFilterCount > 0 && (
                  <Badge tone="violet">
                    {activeFilterCount} filtre
                    {activeFilterCount > 1 ? "s" : ""} actif
                    {activeFilterCount > 1 ? "s" : ""}
                  </Badge>
                )}

                {userEmail && <Badge tone="blue">{userEmail}</Badge>}
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

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/70">
                Filtres
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Périmètre d’analyse
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Sélectionne une période, plusieurs saisons, plusieurs lieux ou
                plusieurs formats de partie. Les indicateurs se recalculent en
                direct.
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

          <div className="mt-7 grid gap-3 xl:grid-cols-[1.45fr_1fr_1fr_1fr]">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              minDate={gameDateBounds.minDate}
              maxDate={gameDateBounds.maxDate}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
            />

            <MultiSelectFilter
              label="Saisons"
              placeholder="Toutes les saisons"
              options={seasonOptions}
              values={seasonFilter}
              onChange={setSeasonFilter}
            />

            <MultiSelectFilter
              label="Lieux"
              placeholder="Tous les lieux"
              options={locationOptions}
              values={locationFilter}
              onChange={setLocationFilter}
            />

            <MultiSelectFilter
              label="Joueurs"
              placeholder="Tous les formats"
              options={playerCountOptions}
              values={playersFilter}
              onChange={setPlayersFilter}
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

              {locationFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={value}
                  onRemove={() =>
                    setLocationFilter((current) =>
                      current.filter((item) => item !== value)
                    )
                  }
                />
              ))}

              {playersFilter.map((value) => (
                <FilterChip
                  key={value}
                  label={`${value} joueurs`}
                  onRemove={() =>
                    setPlayersFilter((current) =>
                      current.filter((item) => item !== value)
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            title="Parties"
            value={filteredGames.length}
            subtitle="Périmètre actif"
            tone="blue"
          />
          <KpiCard
            title="Joueurs actifs"
            value={filteredPlayers.length}
            subtitle="Sur la période"
            tone="emerald"
          />
          <KpiCard
            title="Parties / jour"
            value={gamesPerDay}
            subtitle="Rythme moyen"
            tone="violet"
          />
          <KpiCard
            title="Score moyen"
            value={averageScore}
            subtitle="Score gagnant moyen"
            tone="violet"
          />
          <KpiCard
            title="Meilleur score"
            value={bestScore}
            subtitle="Record période"
            tone="amber"
          />
          <KpiCard
            title="Pire score"
            value={worstScore}
            subtitle="Score maximum constaté"
            tone="red"
          />
        </section>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <ChartSection
            eyebrow="Activité"
            title="Activité et tendance des scores"
            description="Évolution des parties, scores minimum, moyen et maximum."
          >
            <ChartViewport>
              <ActivityChart games={filteredGames} />
            </ChartViewport>
          </ChartSection>

          <ChartSection
            eyebrow="Participation"
            title="Nombre de joueurs par partie"
            description="Répartition du format des parties jouées."
          >
            <ChartViewport>
              <PlayersPerGameChart games={filteredGames} />
            </ChartViewport>
          </ChartSection>
        </section>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <ChartSection
            eyebrow="Scores"
            title="Répartition des scores"
            description="Distribution des scores par tranche."
          >
            <ChartViewport>
              <ScoreDistributionChart games={filteredGames} />
            </ChartViewport>
          </ChartSection>

          <ChartSection
            eyebrow="Positionnement"
            title="Positionnement compétitif des joueurs"
            description="Lecture croisée entre score moyen, taux de victoire et volume de parties."
          >
            <ChartViewport>
              <CompetitivePositionChart players={filteredPlayers} />
            </ChartViewport>
          </ChartSection>
        </section>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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
              {filteredPlayers.slice(0, 4).map((player: any) => (
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
              {filteredGames.slice(0, 3).map((game: any) => (
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

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
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
        <div className="absolute left-0 top-[calc(100%+0.75rem)] z-50 w-[min(390px,calc(100vw-2rem))] rounded-[1.5rem] border border-white/10 bg-[#020617] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="mb-4 grid grid-cols-[32px_32px_minmax(0,110px)_86px_32px_32px] items-center gap-2">
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

            <CalendarSelect
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

            <CalendarSelect
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
              const today = isSameDay(day, new Date());
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
                    today && !selected ? "border border-blue-400/40" : "",
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

function CalendarSelect({
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
        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-left text-sm font-semibold text-white outline-none transition hover:border-blue-400/40 focus:border-blue-400/60"
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <span className="text-xs text-zinc-500">⌄</span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[70] max-h-64 w-full min-w-[120px] overflow-y-auto rounded-xl border border-white/10 bg-[#020617] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
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
        <span
          className={values.length === 0 ? "truncate text-zinc-500" : "truncate"}
        >
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

function ChartSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>

      <div className="mt-6 min-w-0">{children}</div>
    </section>
  );
}

function ChartViewport({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="w-full min-w-0 max-w-full [&_.recharts-responsive-container]:!w-full">
        {children}
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

function getGameDateValue(game: any) {
  if (game.dateTimestamp) {
    const timestamp = Number(game.dateTimestamp);
    return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  }

  if (!game.date) {
    return null;
  }

  const value = String(game.date);

  if (value.includes("-")) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const [day, month, year] = value.split("/").map(Number);

  if (!day || !month || !year) {
    return null;
  }

  return new Date(year, month - 1, day).getTime();
}

function getGameSeason(game: any) {
  const timestamp = getGameDateValue(game);

  if (timestamp === null) {
    return null;
  }

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

function formatDate(date: Date) {
  return format(date, "dd/MM/yyyy", { locale: fr });
}

function getLastGameDate(games: any[]) {
  if (games.length === 0) {
    return null;
  }

  const sorted = [...games].sort(
    (a, b) => (getGameDateValue(b) ?? 0) - (getGameDateValue(a) ?? 0)
  );

  return sorted[0]?.date ?? null;
}

function getGamesPerDay(games: any[]) {
  const days = new Set(games.map((game: any) => game.date).filter(Boolean)).size;

  if (days === 0) {
    return "0,00";
  }

  return (games.length / days).toFixed(2).replace(".", ",");
}
