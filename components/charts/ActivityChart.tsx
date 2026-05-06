"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ActivityChart({ games }: { games: any[] }) {
  const dataMap = new Map<string, any>();

  games.forEach((game) => {
    const date = game.date;

    if (!dataMap.has(date)) {
      dataMap.set(date, {
        date,
        dateTimestamp: game.dateTimestamp ?? 0,
        games: 0,
        minScore: Infinity,
        maxScore: -Infinity,
        totalScore: 0,
        count: 0,
      });
    }

    const entry = dataMap.get(date);

    entry.games += 1;

    const scores = game.results?.map((result: any) => result.score) ?? [
      game.bestScore,
    ];

    scores.forEach((score: number) => {
      entry.totalScore += score;
      entry.count += 1;
      entry.minScore = Math.min(entry.minScore, score);
      entry.maxScore = Math.max(entry.maxScore, score);
    });
  });

  const chartData = Array.from(dataMap.values())
    .map((item) => ({
      date: item.date,
      dateTimestamp: item.dateTimestamp,
      games: item.games,
      minScore: item.minScore === Infinity ? 0 : item.minScore,
      avgScore:
        item.count > 0 ? Number((item.totalScore / item.count).toFixed(2)) : 0,
      maxScore: item.maxScore === -Infinity ? 0 : item.maxScore,
    }))
    .sort((a, b) => a.dateTimestamp - b.dateTimestamp);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ChartLegend color="bg-blue-400" label="Parties jouées" />
        <ChartLegend color="bg-violet-500" label="Score maximum" />
        <ChartLegend color="bg-emerald-400" label="Score moyen" />
        <ChartLegend color="bg-blue-600" label="Score minimum" />
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />

            <XAxis
              dataKey="date"
              stroke="#a1a1aa"
              tick={{ fontSize: 12 }}
              tickMargin={10}
            />

            <YAxis
              yAxisId="left"
              stroke="#a1a1aa"
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#a1a1aa"
              tick={{ fontSize: 12 }}
            />

            <Tooltip
              cursor={{
                stroke: "rgba(255,255,255,0.28)",
                strokeWidth: 1,
              }}
              content={<ActivityTooltip />}
            />

            <Bar
              yAxisId="left"
              dataKey="games"
              name="Parties jouées"
              fill="#60a5fa"
              radius={[10, 10, 0, 0]}
              opacity={0.75}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="minScore"
              name="Score minimum"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4 }}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgScore"
              name="Score moyen"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4 }}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="maxScore"
              name="Score maximum"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-xs font-medium text-zinc-300">{label}</span>
    </div>
  );
}

function ActivityTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0]?.payload;
  const formattedDate = formatTooltipDate(item.date, item.dateTimestamp);

  return (
    <div className="min-w-[230px] rounded-2xl border border-white/10 bg-gradient-to-br from-[#020617]/95 via-[#030712]/95 to-[#0f172a]/90 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
          Journée analysée
        </p>

        <p className="mt-1 text-sm font-semibold text-white">
          {formattedDate}
        </p>
      </div>

      <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
        <TooltipRow
          label="Parties jouées"
          value={item.games}
          valueClassName="text-blue-300"
        />

        <TooltipRow
          label="Score maximum"
          value={item.maxScore}
          valueClassName="text-violet-300"
        />

        <TooltipRow
          label="Score moyen"
          value={item.avgScore}
          valueClassName="text-emerald-300"
        />

        <TooltipRow
          label="Score minimum"
          value={item.minScore}
          valueClassName="text-blue-300"
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
      <span className={`font-semibold tabular-nums ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}

function formatTooltipDate(date: string, dateTimestamp?: number) {
  const parsedDate =
    dateTimestamp && dateTimestamp > 0
      ? new Date(dateTimestamp)
      : parseFrenchDate(date);

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function parseFrenchDate(date: string) {
  const [day, month, year] = date.split("/").map(Number);

  if (!day || !month || !year) {
    return null;
  }

  return new Date(year, month - 1, day);
}