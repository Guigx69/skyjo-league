"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

const PLAYER_COLORS = [
  "#60a5fa",
  "#818cf8",
  "#fb7185",
  "#f59e0b",
  "#34d399",
  "#a78bfa",
  "#f472b6",
  "#22c55e",
  "#38bdf8",
  "#e879f9",
];

export default function CompetitivePositionChart({
  players,
}: {
  players: any[];
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);

  const chartData = useMemo(
    () =>
      players
        .map((player: any, index: number) => ({
          id: String(player.id ?? player.name),
          name: player.name,
          averageScore:
            player.averageScore ??
            player.avgScore ??
            player.scoreAverage ??
            player.scoreMoyen ??
            0,
          winRate: player.winRate ?? player.winrate ?? 0,
          games:
            player.games ??
            player.gamesPlayed ??
            player.parties ??
            player.totalGames ??
            0,
          elo: player.elo ?? 0,
          rank: player.rank ?? index + 1,
          fill: PLAYER_COLORS[index % PLAYER_COLORS.length],
        }))
        .filter((player) => player.averageScore > 0 || player.winRate > 0)
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [players]
  );

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return chartData;
    }

    return chartData.filter((player) =>
      player.name.toLowerCase().includes(query)
    );
  }, [chartData, search]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-zinc-500">
        Données insuffisantes pour afficher le positionnement compétitif.
      </div>
    );
  }

  const averageScores = chartData.map((player) => player.averageScore);
  const winRates = chartData.map((player) => player.winRate);
  const maxGames = Math.max(...chartData.map((player) => player.games), 1);

  const xMin = Math.max(0, Math.floor(Math.min(...averageScores) - 2));
  const xMax = Math.ceil(Math.max(...averageScores) + 3);
  const yMin = 0;
  const yMax = 100;

  const scoreThreshold = median(averageScores);
  const winRateThreshold = median(winRates);

  const selectedPlayer =
    selectedPlayerId === "all"
      ? null
      : chartData.find((player) => player.id === selectedPlayerId);

  const selectedPlayerLabel = selectedPlayer?.name ?? "Tous les joueurs";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-black/20 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Analyse compétitive
          </p>

          <p className="mt-1 text-sm leading-6 text-zinc-400">
            À gauche, les joueurs avec un score moyen plus bas. En haut, les
            joueurs avec un meilleur taux de victoire.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[340px]">
            <button
              type="button"
              onClick={() => setIsSelectorOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-2xl border border-blue-400/50 bg-[#020617] px-4 py-3 text-left text-sm font-medium text-white outline-none transition hover:border-blue-300/70 focus:border-blue-300"
            >
              <span className="truncate">{selectedPlayerLabel}</span>
              <span className="ml-4 shrink-0 text-xs text-zinc-500">
                {isSelectorOpen ? "▲" : "▼"}
              </span>
            </button>

            {isSelectorOpen && (
              <div className="absolute right-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#020617] shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
                <div className="border-b border-white/10 p-3">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher un joueur..."
                    autoFocus
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-medium text-white outline-none transition placeholder:text-zinc-600 hover:border-blue-400/40 focus:border-blue-400/60"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayerId("all");
                      setSearch("");
                      setIsSelectorOpen(false);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      selectedPlayerId === "all"
                        ? "bg-blue-400/10 text-blue-200"
                        : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    Tous les joueurs
                  </button>

                  {filteredPlayers.map((player) => (
                    <button
                      type="button"
                      key={player.id}
                      onClick={() => {
                        setSelectedPlayerId(player.id);
                        setSearch("");
                        setIsSelectorOpen(false);
                      }}
                      className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                        selectedPlayerId === player.id
                          ? "bg-blue-400/10 text-blue-200"
                          : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span className="truncate">{player.name}</span>
                      <span className="ml-3 shrink-0 text-xs text-zinc-600">
                        #{player.rank}
                      </span>
                    </button>
                  ))}

                  {filteredPlayers.length === 0 && (
                    <div className="px-3 py-6 text-center text-sm text-zinc-500">
                      Aucun joueur trouvé.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAllLabels((current) => !current)}
            className={`shrink-0 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              showAllLabels
                ? "border-blue-400/50 bg-blue-400/10 text-blue-200"
                : "border-white/10 bg-[#020617] text-zinc-400 hover:border-blue-400/40 hover:text-white"
            }`}
          >
            {showAllLabels ? "Masquer noms" : "Comparer noms"}
          </button>
        </div>
      </div>

      <div className="h-[500px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 34, right: 28, bottom: 34, left: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />

            <ReferenceArea
              x1={xMin}
              x2={scoreThreshold}
              y1={winRateThreshold}
              y2={yMax}
              fill="#22c55e"
              fillOpacity={0.085}
            />
            <ReferenceArea
              x1={scoreThreshold}
              x2={xMax}
              y1={winRateThreshold}
              y2={yMax}
              fill="#f59e0b"
              fillOpacity={0.07}
            />
            <ReferenceArea
              x1={xMin}
              x2={scoreThreshold}
              y1={yMin}
              y2={winRateThreshold}
              fill="#38bdf8"
              fillOpacity={0.06}
            />
            <ReferenceArea
              x1={scoreThreshold}
              x2={xMax}
              y1={yMin}
              y2={winRateThreshold}
              fill="#a1a1aa"
              fillOpacity={0.05}
            />

            <ReferenceLine
              x={scoreThreshold}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={winRateThreshold}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="4 4"
            />

            <XAxis
              type="number"
              dataKey="averageScore"
              domain={[xMin, xMax]}
              stroke="#a1a1aa"
              tick={{ fontSize: 12 }}
              tickMargin={10}
              allowDecimals={false}
              label={{
                value: "Score moyen · plus bas = meilleur",
                position: "insideBottom",
                offset: -18,
                fill: "#a1a1aa",
                fontSize: 12,
              }}
            />

            <YAxis
              type="number"
              dataKey="winRate"
              domain={[0, 100]}
              stroke="#a1a1aa"
              tick={{ fontSize: 12 }}
              tickMargin={10}
              tickFormatter={(value) => `${value}%`}
              label={{
                value: "Taux de victoire",
                angle: -90,
                position: "insideLeft",
                fill: "#a1a1aa",
                fontSize: 12,
              }}
            />

            <ZAxis
              type="number"
              dataKey="games"
              range={[180, 1150]}
              domain={[0, maxGames]}
            />

            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 }}
              content={
                <CompetitiveTooltip
                  scoreThreshold={scoreThreshold}
                  winRateThreshold={winRateThreshold}
                />
              }
            />

            <Scatter
              data={chartData}
              onClick={(point: any) => {
                setSelectedPlayerId(String(point.id));
                setSearch("");
              }}
              shape={
                <Bubble
                  selectedPlayerId={selectedPlayerId}
                  showAllLabels={showAllLabels}
                />
              }
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <QuadrantCard
          title="Performance élevée"
          description="Score moyen bas et taux de victoire élevé."
          tone="emerald"
        />
        <QuadrantCard
          title="Victoire efficace"
          description="Bon taux de victoire malgré un score moyen plus élevé."
          tone="amber"
        />
        <QuadrantCard
          title="Stabilité"
          description="Score moyen solide, mais conversion en victoire plus faible."
          tone="blue"
        />
        <QuadrantCard
          title="Marge de progression"
          description="Score moyen et taux de victoire à améliorer."
          tone="zinc"
        />
      </div>
    </div>
  );
}

function Bubble(props: any) {
  const { cx, cy, fill, payload, selectedPlayerId, showAllLabels } = props;

  const hasSelection = selectedPlayerId !== "all";
  const isSelected = selectedPlayerId === payload.id;
  const isDimmed = hasSelection && !isSelected;
  const radius = getBubbleRadius(payload.games);

  const shouldShowLabel = isSelected || showAllLabels;

  return (
    <g>
      {isSelected && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={radius + 10}
            fill={fill}
            fillOpacity={0.08}
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius + 7}
            fill="none"
            stroke={fill}
            strokeOpacity={0.95}
            strokeWidth={2}
          />
        </>
      )}

      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        fillOpacity={isDimmed ? 0.12 : showAllLabels ? 0.72 : 0.86}
        stroke="rgba(255,255,255,0.38)"
        strokeOpacity={isDimmed ? 0.14 : 1}
        strokeWidth={isSelected ? 2 : 1}
        className="cursor-pointer"
      />

      {shouldShowLabel && (
        <text
          x={cx}
          y={cy + radius + 14}
          textAnchor="middle"
          fill={isDimmed ? "#71717a" : isSelected ? "#ffffff" : "#d4d4d8"}
          fontSize={showAllLabels ? 10 : 11}
          fontWeight={isSelected ? 700 : 500}
          pointerEvents="none"
        >
          {payload.name}
        </text>
      )}
    </g>
  );
}

function CompetitiveTooltip({
  active,
  payload,
  scoreThreshold,
  winRateThreshold,
}: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0].payload;
  const profile = getSkyjoProfile(item, scoreThreshold, winRateThreshold);

  return (
    <div className="min-w-[270px] -translate-y-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#020617]/95 via-[#030712]/95 to-[#0f172a]/90 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
        Joueur
      </p>

      <p className="mt-1 text-sm font-semibold text-white">{item.name}</p>

      <p className={`mt-2 text-xs font-semibold ${profile.className}`}>
        {profile.label}
      </p>

      <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
        <TooltipRow label="Rang" value={`#${item.rank}`} />
        <TooltipRow label="Elo" value={item.elo} />
        <TooltipRow label="Score moyen" value={item.averageScore} />
        <TooltipRow label="Taux de victoire" value={`${item.winRate}%`} />
        <TooltipRow label="Parties jouées" value={item.games} />
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-6 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

function QuadrantCard({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: "emerald" | "amber" | "blue" | "zinc";
}) {
  const toneClass = {
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    blue: "text-blue-300",
    zinc: "text-zinc-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className={`text-sm font-semibold ${toneClass[tone]}`}>{title}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
    </div>
  );
}

function getBubbleRadius(games: number) {
  if (games >= 40) return 24;
  if (games >= 25) return 21;
  if (games >= 15) return 18;
  if (games >= 8) return 15;
  return 12;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function getSkyjoProfile(
  player: any,
  scoreThreshold: number,
  winRateThreshold: number
) {
  const goodScore = player.averageScore <= scoreThreshold;
  const goodWinRate = player.winRate >= winRateThreshold;

  if (goodScore && goodWinRate) {
    return {
      label: "Performance élevée",
      className: "text-emerald-300",
    };
  }

  if (!goodScore && goodWinRate) {
    return {
      label: "Victoire efficace",
      className: "text-amber-300",
    };
  }

  if (goodScore && !goodWinRate) {
    return {
      label: "Stabilité",
      className: "text-blue-300",
    };
  }

  return {
    label: "Marge de progression",
    className: "text-zinc-300",
  };
}