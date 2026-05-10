"use client";

import { useMemo, useState } from "react";
import { format, isValid, parse, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import AppShell from "@/components/AppShell";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useSkyjoData } from "@/lib/useSkyjoData";

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
  location?: string;
  lieu?: string;
  Lieu?: string;
  place?: string;
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

type DuelGame = {
  id: string | number;
  dateLabel: string;
  timestamp: number;
  playerAScore?: number;
  playerBScore?: number;
  playerAPosition?: number;
  playerBPosition?: number;
  winner: "A" | "B" | "draw" | "unknown";
  scoreGap?: number;
  playersCount?: number;
  location: string;
};

type DuelStats = {
  totalGames: number;
  playerAWins: number;
  playerBWins: number;
  draws: number;
  playerAWinRate: number;
  playerBWinRate: number;
  playerAAverageScore?: number;
  playerBAverageScore?: number;
  playerAAveragePosition?: number;
  playerBAveragePosition?: number;
  averageScoreGap?: number;
  bestWinA?: DuelGame;
  bestWinB?: DuelGame;
  lastGame?: DuelGame;
  leader: "A" | "B" | "draw" | "none";
};

type TimelinePoint = {
  label: string;
  timestamp: number;
  aWins: number;
  bWins: number;
};

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

export default function AdversityPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });
  const { data, loading } = useSkyjoData();

  const players = (data?.players ?? []) as Player[];
  const games = (data?.games ?? []) as Game[];

  const playerOptions = useMemo(() => {
    return players
      .map((player) => {
        const name = getPlayerName(player);
        return {
          id: String(getPlayerId(player) ?? name),
          name,
        };
      })
      .filter((player) => player.name.trim() !== "")
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [players]);

  const [playerAId, setPlayerAId] = useState<string>("");
  const [playerBId, setPlayerBId] = useState<string>("");

  const selectedPlayerA = useMemo(() => {
    return playerOptions.find((player) => player.id === playerAId) ?? null;
  }, [playerOptions, playerAId]);

  const selectedPlayerB = useMemo(() => {
    return playerOptions.find((player) => player.id === playerBId) ?? null;
  }, [playerOptions, playerBId]);

  const duelGames = useMemo(() => {
    if (!selectedPlayerA || !selectedPlayerB) {
      return [];
    }

    return buildDuelGames(games, selectedPlayerA.name, selectedPlayerB.name);
  }, [games, selectedPlayerA, selectedPlayerB]);

  const stats = useMemo(() => {
    return buildDuelStats(duelGames);
  }, [duelGames]);

  const timeline = useMemo(() => {
    return buildTimeline(duelGames);
  }, [duelGames]);

  const samePlayerSelected =
    selectedPlayerA !== null &&
    selectedPlayerB !== null &&
    selectedPlayerA.id === selectedPlayerB.id;

  const canShowDuel = selectedPlayerA && selectedPlayerB && !samePlayerSelected;

  const colorA = selectedPlayerA ? getPlayerColor(selectedPlayerA.id) : "#38bdf8";
  const colorB = selectedPlayerB ? getPlayerColor(selectedPlayerB.id) : "#f59e0b";

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement de l’adversité...
        </div>
      </main>
    );
  }

  return (
    <AppShell>
      <div className="w-full max-w-full overflow-x-hidden space-y-8 sm:space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-red-500/[0.08] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="absolute right-[-90px] top-[-90px] h-60 w-60 rounded-full bg-red-500/20 blur-3xl" />
          <div className="absolute bottom-[-120px] left-[25%] h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-300/80">
                Adversité
              </p>

              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Analyse directe entre deux joueurs
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">
                Sélectionne deux joueurs différents pour générer un écran de
                match-up : victoires directes, score moyen en duel, win rate,
                écarts, dernière confrontation et évolution du duel dans le
                temps.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Badge>{games.length} parties disponibles</Badge>
                <Badge tone="blue">{playerOptions.length} joueurs</Badge>
                {canShowDuel && (
                  <Badge tone="red">
                    {selectedPlayerA.name} vs {selectedPlayerB.name}
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <p className="text-xs text-zinc-500">Confrontations trouvées</p>
              <p className="mt-2 text-4xl font-semibold text-white">
                {canShowDuel ? stats.totalGames : "—"}
              </p>
              <p className="mt-1 text-sm text-red-200">
                {canShowDuel
                  ? getDuelVerdict(stats, selectedPlayerA.name, selectedPlayerB.name)
                  : "Sélectionne deux joueurs"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-slate-950/30 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-5">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_18px_rgba(248,113,113,0.75)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-red-200/70">
                  Sélection
                </p>
              </div>

              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Choisir le duel
              </h2>

              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Les deux joueurs doivent être différents.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPlayerAId("");
                setPlayerBId("");
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white hover:text-slate-950"
            >
              Réinitialiser
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
            <PlayerSelect
              label="Joueur 1"
              value={playerAId}
              options={playerOptions}
              onChange={setPlayerAId}
            />

            <div className="hidden h-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 px-5 text-sm font-semibold text-zinc-400 lg:flex">
              VS
            </div>

            <PlayerSelect
              label="Joueur 2"
              value={playerBId}
              options={playerOptions}
              onChange={setPlayerBId}
            />
          </div>

          {samePlayerSelected && (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Les deux joueurs sélectionnés sont identiques. Choisis deux
              joueurs différents pour lancer l’analyse.
            </div>
          )}
        </section>

        {!selectedPlayerA || !selectedPlayerB ? (
          <EmptyState />
        ) : samePlayerSelected ? (
          <SamePlayerState />
        ) : stats.totalGames === 0 ? (
          <NoDuelState
            playerA={selectedPlayerA.name}
            playerB={selectedPlayerB.name}
          />
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
              <div
                className="absolute left-[-80px] top-[-80px] h-52 w-52 rounded-full blur-3xl"
                style={{ backgroundColor: `${colorA}22` }}
              />
              <div
                className="absolute bottom-[-100px] right-[-80px] h-56 w-56 rounded-full blur-3xl"
                style={{ backgroundColor: `${colorB}22` }}
              />

              <div className="relative grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                <PlayerVersusCard
                  align="left"
                  playerName={selectedPlayerA.name}
                  color={colorA}
                  wins={stats.playerAWins}
                  winRate={stats.playerAWinRate}
                  averageScore={stats.playerAAverageScore}
                  averagePosition={stats.playerAAveragePosition}
                />

                <div className="flex items-center justify-center">
                  <div className="rounded-full border border-white/10 bg-black/30 px-6 py-4 text-3xl font-semibold tracking-[0.2em] text-white shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
                    VS
                  </div>
                </div>

                <PlayerVersusCard
                  align="right"
                  playerName={selectedPlayerB.name}
                  color={colorB}
                  wins={stats.playerBWins}
                  winRate={stats.playerBWinRate}
                  averageScore={stats.playerBAverageScore}
                  averagePosition={stats.playerBAveragePosition}
                />
              </div>

              <div className="relative mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Verdict
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {getDuelVerdict(stats, selectedPlayerA.name, selectedPlayerB.name)}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {getDuelNarrative(stats, selectedPlayerA.name, selectedPlayerB.name)}
                </p>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Parties jouées ensemble"
                value={stats.totalGames}
                subtitle="Confrontations directes"
                tone="blue"
              />
              <KpiCard
                title="Écart moyen de score"
                value={formatMaybeNumber(stats.averageScoreGap)}
                subtitle="Différence absolue moyenne"
                tone="violet"
              />
              <BestWinKpiCard
                stats={stats}
                playerA={selectedPlayerA.name}
                playerB={selectedPlayerB.name}
              />
              <KpiCard
                title="Dernière confrontation"
                value={stats.lastGame?.dateLabel ?? "—"}
                subtitle={getLastGameSubtitle(
                  stats,
                  selectedPlayerA.name,
                  selectedPlayerB.name
                )}
                tone="red"
              />
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                    Dynamique temporelle
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    Évolution du duel dans le temps
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Cumul des victoires directes au fil des confrontations.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <DuelTimelineChart
                  data={timeline}
                  playerA={selectedPlayerA.name}
                  playerB={selectedPlayerB.name}
                  colorA={colorA}
                  colorB={colorB}
                />
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Historique
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Confrontations
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Liste des parties où les deux joueurs étaient présents.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {duelGames.map((game, index) => (
                  <DuelGameCard
                    key={`${game.id}-${index}`}
                    game={game}
                    playerA={selectedPlayerA.name}
                    playerB={selectedPlayerB.name}
                    colorA={colorA}
                    colorB={colorB}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function PlayerSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
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
        className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none transition hover:border-red-400/40 focus:border-red-400/60"
      >
        <option value="">Sélectionner</option>
        {options.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-4xl">⚔️</p>
      <h2 className="mt-4 text-2xl font-semibold text-white">
        Sélectionne deux joueurs
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
        La page générera automatiquement le face-à-face : victoires, win rate,
        score moyen, écart moyen, dynamique temporelle et historique des duels.
      </p>
    </section>
  );
}

function SamePlayerState() {
  return (
    <section className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/[0.08] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-4xl">🟡</p>
      <h2 className="mt-4 text-2xl font-semibold text-white">
        Les joueurs sont identiques
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-100/80">
        Choisis deux joueurs différents pour calculer une vraie adversité.
      </p>
    </section>
  );
}

function NoDuelState({
  playerA,
  playerB,
}: {
  playerA: string;
  playerB: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-4xl">🕊️</p>
      <h2 className="mt-4 text-2xl font-semibold text-white">
        Aucun duel trouvé
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
        {playerA} et {playerB} n’ont pas encore joué dans une même partie dans
        les données importées.
      </p>
    </section>
  );
}

function PlayerVersusCard({
  align,
  playerName,
  color,
  wins,
  winRate,
  averageScore,
  averagePosition,
}: {
  align: "left" | "right";
  playerName: string;
  color: string;
  wins: number;
  winRate: number;
  averageScore?: number;
  averagePosition?: number;
}) {
  const alignClass = align === "right" ? "lg:text-right" : "lg:text-left";

  return (
    <div className={`rounded-[1.5rem] border border-white/10 bg-black/20 p-5 ${alignClass}`}>
      <div
        className={`flex items-center gap-3 ${
          align === "right" ? "lg:justify-end" : ""
        }`}
      >
        <span
          className="h-3 w-3 rounded-full shadow-[0_0_18px_currentColor]"
          style={{ backgroundColor: color, color }}
        />
        <p className="truncate text-2xl font-semibold text-white">
          {playerName}
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <MiniMetric label="Victoires" value={wins} tone="white" />
        <MiniMetric
          label="Win Rate"
          value={`${formatMaybeNumber(winRate)}%`}
          tone="emerald"
        />
        <MiniMetric
          label="Score moyen"
          value={formatMaybeNumber(averageScore)}
          tone="amber"
        />
        <MiniMetric
          label="Position moy."
          value={formatMaybeNumber(averagePosition)}
          tone="blue"
        />
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "white" | "emerald" | "amber" | "blue";
}) {
  const toneClass = {
    white: "text-white",
    emerald: "text-emerald-300",
    amber: "text-orange-300",
    blue: "text-blue-300",
  }[tone];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function BestWinKpiCard({
  stats,
  playerA,
  playerB,
}: {
  stats: DuelStats;
  playerA: string;
  playerB: string;
}) {
  const bestWin = getBestWin(stats, playerA, playerB);

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-sm text-zinc-400">Plus grand écart (gagnant)</p>

      <p className="mt-4 text-2xl font-semibold text-white">
        {bestWin ? `${formatMaybeNumber(bestWin.gap)} pts` : "—"}
      </p>

      <p className="mt-3 truncate text-xs text-amber-300">
        {bestWin?.player ?? "Plus gros écart constaté"}
      </p>
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
  tone: "blue" | "violet" | "amber" | "red";
}) {
  const toneClass = {
    blue: "text-blue-300",
    violet: "text-violet-300",
    amber: "text-amber-300",
    red: "text-red-300",
  }[tone];

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-4 text-2xl font-semibold text-white">{value || "—"}</p>
      <p className={`mt-3 text-xs ${toneClass}`}>{subtitle}</p>
    </div>
  );
}

function DuelTimelineChart({
  data,
  playerA,
  playerB,
  colorA,
  colorB,
}: {
  data: TimelinePoint[];
  playerA: string;
  playerB: string;
  colorA: string;
  colorB: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 1120;
  const height = 340;
  const padding = { top: 24, right: 30, bottom: 48, left: 46 };

  const maxValue = Math.max(
    1,
    ...data.flatMap((point) => [point.aWins, point.bWins])
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

  const lineA = data
    .map((point, index) => `${x(index)},${y(point.aWins)}`)
    .join(" ");
  const lineB = data
    .map((point, index) => `${x(index)},${y(point.bWins)}`)
    .join(" ");
  const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;
  const tooltipLeft =
    hoveredIndex !== null
      ? `${Math.min(82, Math.max(12, (x(hoveredIndex) / width) * 100))}%`
      : "50%";

  if (data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/20 text-sm text-zinc-500">
        Aucune donnée temporelle disponible.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <LegendDot label={playerA} color={colorA} />
        <LegendDot label={playerB} color={colorB} />
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[320px] w-full sm:h-[340px]"
          role="img"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value = Math.round(maxValue * ratio);
            return (
              <g key={ratio}>
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
            );
          })}

          <polyline
            fill="none"
            stroke={colorA}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={lineA}
          />

          <polyline
            fill="none"
            stroke={colorB}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={lineB}
          />

          {data.map((point, index) => {
            const shouldShow =
              data.length <= 8 ||
              index === 0 ||
              index === data.length - 1 ||
              index % Math.ceil(data.length / 6) === 0;

            if (!shouldShow) return null;

            return (
              <text
                key={`${point.timestamp}-label-${index}`}
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
            const hoverWidth = Math.max(28, plotWidth / Math.max(data.length, 1));

            return (
              <g key={`hover-${point.timestamp}-${index}`}>
                <rect
                  x={x(index) - hoverWidth / 2}
                  y={padding.top}
                  width={hoverWidth}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {hoveredIndex === index && (
                  <>
                    <line
                      x1={x(index)}
                      x2={x(index)}
                      y1={padding.top}
                      y2={padding.top + plotHeight}
                      stroke="rgba(255,255,255,0.22)"
                      strokeDasharray="4 4"
                    />
                    <circle
                      cx={x(index)}
                      cy={y(point.aWins)}
                      r="4"
                      fill={colorA}
                      stroke="#020617"
                      strokeWidth="2"
                    />
                    <circle
                      cx={x(index)}
                      cy={y(point.bWins)}
                      r="4"
                      fill={colorB}
                      stroke="#020617"
                      strokeWidth="2"
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredPoint && (
        <div
          className="pointer-events-none absolute top-24 z-50 w-[250px] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          style={{ left: tooltipLeft }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Point de passage
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {hoveredPoint.label}
          </p>

          <div className="mt-3 space-y-2">
            <TooltipLine
              label={playerA}
              value={hoveredPoint.aWins}
              color={colorA}
            />
            <TooltipLine
              label={playerB}
              value={hoveredPoint.bWins}
              color={colorB}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TooltipLine({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-xs text-zinc-300">{label}</span>
      </div>
      <span className="text-xs font-semibold text-white">{value}</span>
    </div>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

function DuelGameCard({
  game,
  playerA,
  playerB,
  colorA,
  colorB,
}: {
  game: DuelGame;
  playerA: string;
  playerB: string;
  colorA: string;
  colorB: string;
}) {
  const winnerLabel =
    game.winner === "A"
      ? playerA
      : game.winner === "B"
        ? playerB
        : game.winner === "draw"
          ? "Égalité"
          : "Non déterminé";

  const winnerColor =
    game.winner === "A" ? colorA : game.winner === "B" ? colorB : "#a1a1aa";

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-white">{game.dateLabel}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {game.location || "Lieu non renseigné"} · {game.playersCount ?? "—"} joueurs
          </p>
        </div>

        <div
          className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-semibold"
          style={{ color: winnerColor }}
        >
          {winnerLabel}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DuelScoreBlock
          label={playerA}
          score={game.playerAScore}
          position={game.playerAPosition}
          color={colorA}
        />
        <DuelScoreBlock
          label="Écart"
          score={game.scoreGap}
          position={undefined}
          color="#d4d4d8"
        />
        <DuelScoreBlock
          label={playerB}
          score={game.playerBScore}
          position={game.playerBPosition}
          color={colorB}
        />
      </div>
    </article>
  );
}

function DuelScoreBlock({
  label,
  score,
  position,
  color,
}: {
  label: string;
  score?: number;
  position?: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color }}>
        {formatMaybeNumber(score)}
      </p>
      {position !== undefined && (
        <p className="mt-1 text-xs text-zinc-500">Position #{position}</p>
      )}
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "blue" | "red";
}) {
  const className = {
    default: "border-white/10 bg-white/[0.06] text-zinc-300",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    red: "border-red-400/20 bg-red-400/10 text-red-200",
  }[tone];

  return (
    <div
      className={`max-w-full truncate rounded-full border px-4 py-2 text-xs font-medium ${className}`}
    >
      {children}
    </div>
  );
}

function buildDuelGames(games: Game[], playerA: string, playerB: string): DuelGame[] {
  const duelGames: DuelGame[] = [];

  games.forEach((game, gameIndex) => {
    const results = Array.isArray(game.results) ? game.results : [];
    const normalizedResults = results
      .map((result) => normalizeResult(result))
      .filter((result) => result.name);

    const resultA = normalizedResults.find((result) => result.name === playerA);
    const resultB = normalizedResults.find((result) => result.name === playerB);

    if (!resultA || !resultB) {
      return;
    }

    const timestamp = getGameDateValue(game) ?? 0;
    const winner = getDuelWinner(resultA, resultB);

    const duelGame: DuelGame = {
      id:
        game.id ??
        game.PartieID ??
        game.partieID ??
        `${timestamp}-${playerA}-${playerB}-${gameIndex}`,
      dateLabel: timestamp ? formatDate(new Date(timestamp)) : "Date inconnue",
      timestamp,
      winner,
      location: getGameLocation(game),
    };

    if (resultA.score !== undefined) {
      duelGame.playerAScore = resultA.score;
    }

    if (resultB.score !== undefined) {
      duelGame.playerBScore = resultB.score;
    }

    if (resultA.position !== undefined) {
      duelGame.playerAPosition = resultA.position;
    }

    if (resultB.position !== undefined) {
      duelGame.playerBPosition = resultB.position;
    }

    if (resultA.score !== undefined && resultB.score !== undefined) {
      duelGame.scoreGap = Math.abs(resultA.score - resultB.score);
    }

    const playersCount = getGamePlayersCount(game);
    if (playersCount !== undefined) {
      duelGame.playersCount = playersCount;
    }

    duelGames.push(duelGame);
  });

  return duelGames.sort((a, b) => a.timestamp - b.timestamp);
}

function buildDuelStats(games: DuelGame[]): DuelStats {
  const playerAWins = games.filter((game) => game.winner === "A").length;
  const playerBWins = games.filter((game) => game.winner === "B").length;
  const draws = games.filter((game) => game.winner === "draw").length;
  const totalGames = games.length;

  const scoresA = games
    .map((game) => game.playerAScore)
    .filter((value): value is number => isFiniteNumber(value));
  const scoresB = games
    .map((game) => game.playerBScore)
    .filter((value): value is number => isFiniteNumber(value));
  const positionsA = games
    .map((game) => game.playerAPosition)
    .filter((value): value is number => isFiniteNumber(value));
  const positionsB = games
    .map((game) => game.playerBPosition)
    .filter((value): value is number => isFiniteNumber(value));
  const gaps = games
    .map((game) => game.scoreGap)
    .filter((value): value is number => isFiniteNumber(value));

  const bestWinA = [...games]
    .filter((game) => game.winner === "A" && isFiniteNumber(game.scoreGap))
    .sort((a, b) => (b.scoreGap ?? 0) - (a.scoreGap ?? 0))[0];
  const bestWinB = [...games]
    .filter((game) => game.winner === "B" && isFiniteNumber(game.scoreGap))
    .sort((a, b) => (b.scoreGap ?? 0) - (a.scoreGap ?? 0))[0];

  return {
    totalGames,
    playerAWins,
    playerBWins,
    draws,
    playerAWinRate: totalGames > 0 ? (playerAWins / totalGames) * 100 : 0,
    playerBWinRate: totalGames > 0 ? (playerBWins / totalGames) * 100 : 0,
    playerAAverageScore: average(scoresA),
    playerBAverageScore: average(scoresB),
    playerAAveragePosition: average(positionsA),
    playerBAveragePosition: average(positionsB),
    averageScoreGap: average(gaps),
    bestWinA,
    bestWinB,
    lastGame: games[games.length - 1],
    leader:
      playerAWins > playerBWins
        ? "A"
        : playerBWins > playerAWins
          ? "B"
          : totalGames > 0
            ? "draw"
            : "none",
  };
}

function buildTimeline(games: DuelGame[]): TimelinePoint[] {
  let aWins = 0;
  let bWins = 0;

  return games.map((game) => {
    if (game.winner === "A") {
      aWins += 1;
    }

    if (game.winner === "B") {
      bWins += 1;
    }

    return {
      label: game.dateLabel,
      timestamp: game.timestamp,
      aWins,
      bWins,
    };
  });
}

function getDuelWinner(
  resultA: NormalizedResult,
  resultB: NormalizedResult
): DuelGame["winner"] {
  if (resultA.isWinner && !resultB.isWinner) return "A";
  if (resultB.isWinner && !resultA.isWinner) return "B";

  if (isFiniteNumber(resultA.position) && isFiniteNumber(resultB.position)) {
    if (resultA.position < resultB.position) return "A";
    if (resultB.position < resultA.position) return "B";
    return "draw";
  }

  if (isFiniteNumber(resultA.score) && isFiniteNumber(resultB.score)) {
    if (resultA.score < resultB.score) return "A";
    if (resultB.score < resultA.score) return "B";
    return "draw";
  }

  return "unknown";
}

function getDuelVerdict(stats: DuelStats, playerA: string, playerB: string) {
  if (stats.totalGames === 0) return "Aucune confrontation directe.";

  if (stats.leader === "A") {
    return `${playerA} mène le duel.`;
  }

  if (stats.leader === "B") {
    return `${playerB} mène le duel.`;
  }

  return "Le duel est parfaitement équilibré.";
}

function getDuelNarrative(stats: DuelStats, playerA: string, playerB: string) {
  if (stats.totalGames === 0) return "";

  return `${playerA} compte ${stats.playerAWins} victoire${
    stats.playerAWins > 1 ? "s" : ""
  } contre ${stats.playerBWins} pour ${playerB}, sur ${
    stats.totalGames
  } confrontation${stats.totalGames > 1 ? "s" : ""}.`;
}

function getBestWin(stats: DuelStats, playerA: string, playerB: string) {
  const candidates = [
    stats.bestWinA ? { player: playerA, gap: stats.bestWinA.scoreGap ?? 0 } : null,
    stats.bestWinB ? { player: playerB, gap: stats.bestWinB.scoreGap ?? 0 } : null,
  ].filter(Boolean) as { player: string; gap: number }[];

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => b.gap - a.gap)[0];
}

function getBestWinLabel(stats: DuelStats, playerA: string, playerB: string) {
  const best = getBestWin(stats, playerA, playerB);

  if (!best) return "—";

  return `${best.player} · ${formatMaybeNumber(best.gap)} pts`;
}

function getLastGameSubtitle(stats: DuelStats, playerA: string, playerB: string) {
  const game = stats.lastGame;
  if (!game) return "Aucune donnée";

  if (game.winner === "A") return `Victoire ${playerA}`;
  if (game.winner === "B") return `Victoire ${playerB}`;
  if (game.winner === "draw") return "Égalité";
  return "Résultat non déterminé";
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

function getPlayerName(player: Player) {
  return player.name ?? player.Nom ?? player.nom ?? "";
}

function getPlayerId(player: Player) {
  return player.id ?? player.JoueurID ?? player.joueurID;
}

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

function getGamePlayersCount(game: Game) {
  return toNumber(game.players ?? game.NbJoueurs ?? game.nbJoueurs);
}

function getGameLocation(game: Game) {
  return String(game.location ?? game.lieu ?? game.Lieu ?? game.place ?? "").trim();
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

function formatDate(date: Date) {
  return format(date, "dd/MM/yyyy", { locale: fr });
}

function formatMaybeNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(2).replace(".", ",");
}