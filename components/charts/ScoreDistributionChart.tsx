"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BUCKETS = [
  { id: "neg", label: "-05 à -01", min: -5, max: -1 },
  { id: "00-04", label: "00 à 04", min: 0, max: 4 },
  { id: "05-09", label: "05 à 09", min: 5, max: 9 },
  { id: "10-14", label: "10 à 14", min: 10, max: 14 },
  { id: "15-19", label: "15 à 19", min: 15, max: 19 },
  { id: "20-24", label: "20 à 24", min: 20, max: 24 },
  { id: "25-29", label: "25 à 29", min: 25, max: 29 },
  { id: "30-34", label: "30 à 34", min: 30, max: 34 },
  { id: "35-39", label: "35 à 39", min: 35, max: 39 },
  { id: "40-44", label: "40 à 44", min: 40, max: 44 },
  { id: "45-49", label: "45 à 49", min: 45, max: 49 },
  { id: "50-plus", label: "50+", min: 50, max: Infinity },
];

export default function ScoreDistributionChart({ games }: { games: any[] }) {
  const scores = games.flatMap((game) => {
    if (Array.isArray(game.results)) {
      return game.results
        .map((result: any) => Number(result.score))
        .filter((score: number) => Number.isFinite(score));
    }

    return [game.bestScore, game.worstScore]
      .map((score: any) => Number(score))
      .filter((score: number) => Number.isFinite(score));
  });

  const totalScores = scores.length;

  const data = BUCKETS.map((bucket) => {
    const count = scores.filter(
      (score) => score >= bucket.min && score <= bucket.max
    ).length;

    return {
      ...bucket,
      count,
      percentage:
        totalScores > 0 ? Number(((count / totalScores) * 100).toFixed(1)) : 0,
    };
  }).filter((bucket) => bucket.count > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-zinc-500">
        Données insuffisantes pour afficher la répartition des scores.
      </div>
    );
  }

  const maxCount = Math.max(...data.map((bucket) => bucket.count), 1);

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 42, bottom: 18, left: 12 }}
        >
          <defs>
            <linearGradient id="scoreDistributionGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.95} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />

          <XAxis
            type="number"
            stroke="#a1a1aa"
            tick={{ fontSize: 12 }}
            tickMargin={10}
            allowDecimals={false}
            domain={[0, Math.ceil(maxCount * 1.15)]}
          />

          <YAxis
            type="category"
            dataKey="label"
            stroke="#a1a1aa"
            tick={{ fontSize: 12 }}
            tickMargin={10}
            width={78}
          />

          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.035)" }}
            content={<ScoreDistributionTooltip />}
          />

          <Bar
            dataKey="count"
            name="Nombre de scores"
            fill="url(#scoreDistributionGradient)"
            radius={[0, 12, 12, 0]}
            label={<ScoreDistributionLabel />}
          >
            {data.map((bucket) => (
              <Cell
                key={bucket.id}
                fill={
                  bucket.count === maxCount
                    ? "url(#scoreDistributionGradient)"
                    : "url(#scoreDistributionGradient)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScoreDistributionLabel(props: any) {
  const { x, y, width, height, value } = props;

  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      fill="#e5e7eb"
      fontSize={12}
      fontWeight={700}
      dominantBaseline="middle"
    >
      {value}
    </text>
  );
}

function ScoreDistributionTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="min-w-[240px] -translate-y-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#020617]/95 via-[#030712]/95 to-[#0f172a]/90 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
        Tranche de score
      </p>

      <p className="mt-1 text-sm font-semibold text-white">{item.label}</p>

      <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
        <TooltipRow label="Nombre de scores" value={item.count} />
        <TooltipRow label="Part du total" value={`${item.percentage}%`} />
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