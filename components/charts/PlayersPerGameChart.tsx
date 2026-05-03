"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function PlayersPerGameChart({ games }: { games: any[] }) {
  const map = new Map<number, number>();

  games.forEach((game) => {
    const count = game.players;

    if (!map.has(count)) {
      map.set(count, 0);
    }

    map.set(count, map.get(count)! + 1);
  });

  const data = Array.from(map.entries())
    .map(([players, games]) => ({
      players,
      games,
    }))
    .sort((a, b) => a.players - b.players);

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <defs>
            <linearGradient id="playersBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.55} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.06)" />

          <XAxis
            dataKey="players"
            stroke="#a1a1aa"
            tick={{ fontSize: 12 }}
            tickMargin={10}
            tickFormatter={(value) => `${value} joueurs`}
          />

          <YAxis
            stroke="#a1a1aa"
            tick={{ fontSize: 12 }}
            allowDecimals={false}
          />

          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.035)" }}
            content={<PlayersTooltip />}
          />

          <Bar
            dataKey="games"
            name="Parties jouées"
            fill="url(#playersBarGradient)"
            radius={[12, 12, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlayersTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="min-w-[220px] -translate-y-1 rounded-2xl border border-white/10 bg-gradient-to-br from-[#020617]/95 via-[#030712]/95 to-[#0f172a]/90 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
          Configuration
        </p>

        <p className="mt-1 text-sm font-semibold text-white">
          {item.players} joueurs
        </p>
      </div>

      <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
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