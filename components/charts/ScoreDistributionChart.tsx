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

type ScoreBucket = {
  id: string;
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
};

export default function ScoreDistributionChart({
  games,
}: {
  games: any[];
}) {
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

  if (totalScores === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-zinc-500">
        Données insuffisantes pour afficher la répartition des scores.
      </div>
    );
  }

  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const bucketStart = Math.floor(minScore / 5) * 5;
  const bucketEnd = Math.floor(maxScore / 5) * 5;

  const buckets = Array.from(
    { length: (bucketEnd - bucketStart) / 5 + 1 },
    (_, index) => {
      const min = bucketStart + index * 5;
      const max = min + 4;

      return {
        id: `${min}-${max}`,
        label: formatBucketLabel(min, max),
        min,
        max,
      };
    }
  );

  const data: ScoreBucket[] = buckets
    .map((bucket) => {
      const count = scores.filter(
        (score) => score >= bucket.min && score <= bucket.max
      ).length;

      return {
        ...bucket,
        count,
        percentage:
          totalScores > 0
            ? Number(((count / totalScores) * 100).toFixed(1))
            : 0,
      };
    })
    .filter((bucket) => bucket.count > 0);

  const maxCount = Math.max(...data.map((bucket) => bucket.count), 1);

  const dynamicHeight = Math.max(420, data.length * 34);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ChartLegend
          color="bg-blue-400"
          label="Nombre de scores par tranche"
        />
      </div>

      <div className="w-full" style={{ height: dynamicHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 42, bottom: 18, left: 12 }}
          >
            <defs>
              <linearGradient
                id="scoreDistributionGradient"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.95} />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              horizontal={false}
            />

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
              width={86}
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
                  fill="url(#scoreDistributionGradient)"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartLegend({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />

      <span className="text-xs font-medium text-zinc-300">
        {label}
      </span>
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
    <div className="min-w-[250px] -translate-y-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#020617]/95 via-[#030712]/95 to-[#0f172a]/90 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
        Tranche de score
      </p>

      <p className="mt-1 text-sm font-semibold text-white">
        {item.label}
      </p>

      <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
        <TooltipRow
          label="Nombre de scores"
          value={item.count}
          valueClassName="text-blue-300"
        />

        <TooltipRow
          label="Part du total"
          value={`${item.percentage} %`}
          valueClassName="text-emerald-300"
        />

        <TooltipRow
          label="Intervalle"
          value={`${formatScore(item.min)} à ${formatScore(item.max)}`}
          valueClassName="text-zinc-100"
        />
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 text-sm">
      <span className="text-zinc-400">{label}</span>

      <span
        className={`font-semibold tabular-nums ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function formatBucketLabel(min: number, max: number) {
  return `${formatScore(min)} à ${formatScore(max)}`;
}

function formatScore(value: number) {
  if (value < 0) {
    return `-${String(Math.abs(value)).padStart(2, "0")}`;
  }

  return String(value).padStart(2, "0");
}