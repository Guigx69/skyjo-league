"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
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

type Rivalry = {
  playerA: string;
  playerB: string;
  games: number;
  winsA: number;
  winsB: number;
  domination?: string;
  intensity?: string;
};

type Option = {
  value: string;
  label: string;
};

type HeatCell = {
  exists: boolean;
  games: number;
  rowWins: number;
  opponentWins: number;
  rowWinRate: number;
  opponentWinRate: number;
  tone: "dominant" | "dominated" | "balanced" | "empty";
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  label: string;
  rivalry?: Rivalry;
};

const intensityOptions: Option[] = [
  { value: "all", label: "Toutes" },
  { value: "Forte", label: "Forte" },
  { value: "Moyenne", label: "Moyenne" },
  { value: "Faible", label: "Faible" },
];

const sortOptions: Option[] = [
  { value: "games", label: "Confrontations" },
  { value: "intensity", label: "Intensité" },
  { value: "gap", label: "Domination" },
  { value: "tightness", label: "Duel serré" },
  { value: "name", label: "Nom" },
];

const displayModeOptions: Option[] = [
  { value: "all", label: "Tous les duels" },
  { value: "top10", label: "Top 10" },
  { value: "top50", label: "Top 50" },
  { value: "hot", label: "Plus chauds" },
  { value: "tight", label: "Plus serrés" },
  { value: "dominant", label: "Dominations nettes" },
  { value: "new", label: "Faibles / nouveaux duels" },
];

export default function RivalriesPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });
  const { data, loading } = useSkyjoData();

  const [selectedPlayer, setSelectedPlayer] = useState("all");
  const [selectedIntensity, setSelectedIntensity] = useState("all");
  const [sortBy, setSortBy] = useState("games");
  const [displayMode, setDisplayMode] = useState("all");

  const players = (data?.players ?? []) as Player[];
  const rivalries = ((data?.rivalries ?? []) as Rivalry[])
    .filter((rivalry) => rivalry.playerA && rivalry.playerB)
    .map((rivalry) => ({
      ...rivalry,
      games: Number(rivalry.games ?? 0),
      winsA: Number(rivalry.winsA ?? 0),
      winsB: Number(rivalry.winsB ?? 0),
    }));

  const playerNames = useMemo(() => {
    const fromPlayers = players
      .map((player) => getPlayerName(player))
      .filter(Boolean);

    const fromRivalries = rivalries.flatMap((rivalry) => [
      rivalry.playerA,
      rivalry.playerB,
    ]);

    return Array.from(new Set([...fromPlayers, ...fromRivalries]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "fr"));
  }, [players, rivalries]);

  const playerOptions = useMemo<Option[]>(() => {
    return [
      { value: "all", label: "Tous les joueurs" },
      ...playerNames.map((name) => ({
        value: name,
        label: name,
      })),
    ];
  }, [playerNames]);

  const filteredRivalries = useMemo(() => {
    const base = rivalries.filter((rivalry) => {
      if (
        selectedPlayer !== "all" &&
        rivalry.playerA !== selectedPlayer &&
        rivalry.playerB !== selectedPlayer
      ) {
        return false;
      }

      if (
        selectedIntensity !== "all" &&
        normalizeIntensity(rivalry.intensity) !== selectedIntensity
      ) {
        return false;
      }

      return true;
    });

    const modeFiltered = applyDisplayMode(base, displayMode);
    const sorted = sortRivalries(modeFiltered, sortBy);

    if (displayMode === "top10") return sorted.slice(0, 10);
    if (displayMode === "top50") return sorted.slice(0, 50);

    return sorted;
  }, [rivalries, selectedPlayer, selectedIntensity, sortBy, displayMode]);

  const mostPlayedRivalry = useMemo(() => {
    return [...rivalries].sort((a, b) => b.games - a.games)[0];
  }, [rivalries]);

  const strongestRivalry = useMemo(() => {
    return [...rivalries].sort((a, b) => {
      const intensityDiff =
        getIntensityScore(b.intensity) - getIntensityScore(a.intensity);

      if (intensityDiff !== 0) return intensityDiff;

      return b.games - a.games;
    })[0];
  }, [rivalries]);

  const mostDominantRivalry = useMemo(() => {
    return [...rivalries].sort(
      (a, b) => getDominationGap(b) - getDominationGap(a)
    )[0];
  }, [rivalries]);

  const heatmapPlayers = useMemo(() => {
    if (selectedPlayer !== "all") {
      const relatedPlayers = rivalries
        .filter(
          (rivalry) =>
            rivalry.playerA === selectedPlayer || rivalry.playerB === selectedPlayer
        )
        .flatMap((rivalry) => [rivalry.playerA, rivalry.playerB]);

      return Array.from(new Set([selectedPlayer, ...relatedPlayers]))
        .filter(Boolean)
        .sort((a, b) => {
          if (a === selectedPlayer) return -1;
          if (b === selectedPlayer) return 1;
          return a.localeCompare(b, "fr");
        });
    }

    return playerNames;
  }, [playerNames, rivalries, selectedPlayer]);

  const maxGames = useMemo(() => {
    return Math.max(1, ...rivalries.map((rivalry) => rivalry.games ?? 0));
  }, [rivalries]);

  const activeFilterCount =
    (selectedPlayer !== "all" ? 1 : 0) +
    (selectedIntensity !== "all" ? 1 : 0) +
    (sortBy !== "games" ? 1 : 0) +
    (displayMode !== "hot" ? 1 : 0);

  const resetFilters = () => {
    setSelectedPlayer("all");
    setSelectedIntensity("all");
    setSortBy("games");
    setDisplayMode("hot");
  };

  if (checkingAuth || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm text-zinc-300">
          Chargement des rivalités...
        </div>
      </main>
    );
  }

  if (!rivalries.length) {
    return (
      <AppShell>
        <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/[0.08] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Rivalités
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">
            Aucune rivalité disponible.
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
      <div className="w-full max-w-full overflow-x-hidden space-y-8 sm:space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-red-500/[0.08] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="absolute right-[-90px] top-[-90px] h-60 w-60 rounded-full bg-red-500/20 blur-3xl" />
          <div className="absolute bottom-[-120px] left-[25%] h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-300/80">
                Rivalités
              </p>

              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Cartographie des duels entre joueurs
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">
                Analyse globale des confrontations directes : volume de matchs,
                domination, intensité et heatmap lisible entre tous les joueurs.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Badge>{rivalries.length} rivalités actives</Badge>
                <Badge tone="blue">{playerNames.length} joueurs</Badge>
                {activeFilterCount > 0 && (
                  <Badge tone="red">
                    {activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif
                    {activeFilterCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <p className="text-xs text-zinc-500">Duel le plus joué</p>
              <p className="mt-2 max-w-[280px] text-xl font-semibold text-white">
                {mostPlayedRivalry.playerA} vs {mostPlayedRivalry.playerB}
              </p>
              <p className="mt-1 text-sm text-red-200">
                {mostPlayedRivalry.games} confrontations
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
                  Filtres
                </p>
              </div>

              <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                Lecture des rivalités
              </h2>

              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Filtre par joueur, intensité ou mode de tri. La heatmap et les
                cartes se recalculent ensemble.
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

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <PremiumSelect
              label="Joueur"
              value={selectedPlayer}
              options={playerOptions}
              onChange={setSelectedPlayer}
            />

            <PremiumSelect
              label="Intensité"
              value={selectedIntensity}
              options={intensityOptions}
              onChange={setSelectedIntensity}
            />

            <PremiumSelect
              label="Tri"
              value={sortBy}
              options={sortOptions}
              onChange={setSortBy}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard
            title="Rivalités actives"
            value={filteredRivalries.length}
            subtitle={`${rivalries.length} au total`}
            tone="blue"
          />

          <KpiCard
            title="Match le plus intense"
            value={`${strongestRivalry.playerA} vs ${strongestRivalry.playerB}`}
            subtitle={`Intensité : ${normalizeIntensity(strongestRivalry.intensity)}`}
            tone="red"
          />

          <KpiCard
            title="Domination la plus nette"
            value={`${mostDominantRivalry.playerA} vs ${mostDominantRivalry.playerB}`}
            subtitle={`${getDominationGap(mostDominantRivalry)} victoire(s) d’écart`}
            tone="amber"
          />
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Heatmap
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Carte domination / confrontation
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                La lecture se fait depuis le joueur en ligne vers le joueur en colonne.
                Vert = le joueur en ligne domine. Rouge = il est dominé. Plus
                la couleur est forte, plus le duel est net et/ou fréquent.
                Les duels jamais joués restent neutres.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <HeatLegendItem label="Dominant" className="bg-emerald-500/70" />
              <HeatLegendItem label="Égalité du duel" className="bg-white/[0.12]" />
              <HeatLegendItem label="Dominé" className="bg-red-500/70" />
            </div>
          </div>

          <div className="mt-6">
            <RivalryHeatmap
              players={heatmapPlayers}
              rivalries={filteredRivalries}
              selectedPlayer={selectedPlayer}
              maxGames={maxGames}
            />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Détails
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Rivalités détaillées
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Cartes lisibles pour analyser domination, volume et intensité.
              </p>
            </div>

            <div className="w-full md:w-[260px]">
              <p className="mb-2 text-left text-sm text-zinc-400 md:text-right">
                {filteredRivalries.length} duel{filteredRivalries.length > 1 ? "s" : ""} affiché
                {filteredRivalries.length > 1 ? "s" : ""}
              </p>

              <PremiumSelect
                label="Affichage"
                value={displayMode}
                options={displayModeOptions}
                onChange={setDisplayMode}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <RivalryLegendItem label="Dominant" color="rgba(16,185,129,0.9)" />
            <RivalryLegendItem label="Dominé" color="rgba(244,63,94,0.82)" />
            <RivalryLegendItem label="Égalité du duel" color="rgba(96,165,250,0.78)" />
            <RivalryLegendItem label="Nul / indéterminé" color="rgba(148,163,184,0.55)" />
          </div>

          {filteredRivalries.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-zinc-400">
              Aucun duel ne correspond aux filtres actuels.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredRivalries.map((rivalry, index) => (
                <RivalryCard
                  key={`${rivalry.playerA}-${rivalry.playerB}-${index}`}
                  rivalry={rivalry}
                  selectedPlayer={selectedPlayer}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}


function applyDisplayMode(rivalries: Rivalry[], displayMode: string) {
  if (displayMode === "all" || displayMode === "top10" || displayMode === "top50") {
    return rivalries;
  }

  if (displayMode === "hot") {
    return rivalries.filter(
      (rivalry) =>
        rivalry.games >= 4 ||
        normalizeIntensity(rivalry.intensity) === "Forte"
    );
  }

  if (displayMode === "tight") {
    return rivalries.filter((rivalry) => {
      const gap = getDominationGap(rivalry);
      return rivalry.games >= 3 && gap <= Math.max(1, Math.floor(rivalry.games * 0.12));
    });
  }

  if (displayMode === "dominant") {
    return rivalries.filter((rivalry) => {
      const gap = getDominationGap(rivalry);
      const rateGap = Math.abs(getWinRate(rivalry.winsA, rivalry.games) - getWinRate(rivalry.winsB, rivalry.games));
      return gap >= 3 || rateGap >= 35;
    });
  }

  if (displayMode === "new") {
    return rivalries.filter((rivalry) => rivalry.games <= 3);
  }

  return rivalries;
}

function sortRivalries(rivalries: Rivalry[], sortBy: string) {
  return [...rivalries].sort((a, b) => {
    if (sortBy === "name") {
      return `${a.playerA}-${a.playerB}`.localeCompare(
        `${b.playerA}-${b.playerB}`,
        "fr"
      );
    }

    if (sortBy === "gap") {
      const gapDiff = getDominationGap(b) - getDominationGap(a);
      if (gapDiff !== 0) return gapDiff;
      return b.games - a.games;
    }

    if (sortBy === "tightness") {
      const tightDiff = getTightnessScore(b) - getTightnessScore(a);
      if (tightDiff !== 0) return tightDiff;
      return b.games - a.games;
    }

    if (sortBy === "intensity") {
      const intensityDiff =
        getIntensityScore(b.intensity) - getIntensityScore(a.intensity);

      if (intensityDiff !== 0) return intensityDiff;

      return b.games - a.games;
    }

    return b.games - a.games;
  });
}

function getTightnessScore(rivalry: Rivalry) {
  const gap = getDominationGap(rivalry);
  const games = Math.max(1, rivalry.games);
  const closeness = 1 - gap / games;
  const volumeWeight = Math.min(1, games / 20);

  return closeness * 100 + volumeWeight * 20;
}

function getDisplayModeLabel(displayMode: string) {
  return (
    displayModeOptions.find((option) => option.value === displayMode)?.label ??
    displayMode
  );
}


function RivalryHeatmap({
  players,
  rivalries,
  selectedPlayer,
  maxGames,
}: {
  players: string[];
  rivalries: Rivalry[];
  selectedPlayer: string;
  maxGames: number;
}) {
  if (players.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm text-zinc-500">
        Aucune donnée pour construire la heatmap.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-auto rounded-2xl border border-white/10 bg-black/20 xl:block">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `minmax(190px, 190px) repeat(${players.length}, minmax(82px, 82px))`,
          }}
        >
          <div className="sticky left-0 z-20 border-b border-r border-white/10 bg-[#020617] p-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Joueur
          </div>

          {players.map((player) => (
            <div
              key={`header-${player}`}
              className="border-b border-white/10 bg-white/[0.025] p-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
              title={player}
            >
              <span className="mx-auto block max-w-[72px] truncate">
                {getShortName(player)}
              </span>
            </div>
          ))}

          {players.map((rowPlayer) => (
            <div key={`row-${rowPlayer}`} className="contents">
              <div
                className={`sticky left-0 z-10 border-r border-white/10 bg-[#020617] p-3 text-sm font-medium ${
                  selectedPlayer === rowPlayer ? "text-red-200" : "text-white"
                }`}
                title={rowPlayer}
              >
                <span className="block truncate">{rowPlayer}</span>
              </div>

              {players.map((columnPlayer) => {
                const samePlayer = rowPlayer === columnPlayer;
                const rivalry = getRivalryBetween(rivalries, rowPlayer, columnPlayer);
                const cell = samePlayer
                  ? null
                  : getHeatCell(rivalry, rowPlayer, maxGames);

                return (
                  <div
                    key={`${rowPlayer}-${columnPlayer}`}
                    className={[
                      "group relative flex min-h-[72px] items-center justify-center border-b border-r border-white/5 p-2 text-sm transition",
                      samePlayer
                        ? "bg-white/[0.025] text-zinc-700"
                        : "hover:z-30 hover:ring-1 hover:ring-white/30",
                    ].join(" ")}
                    style={
                      !samePlayer && cell
                        ? {
                            backgroundColor: cell.backgroundColor,
                            borderColor: cell.borderColor,
                          }
                        : undefined
                    }
                  >
                    {samePlayer ? (
                      <span className="text-xs text-zinc-700">—</span>
                    ) : cell && cell.exists ? (
                      <div className="text-center">
                        <p
                          className="text-base font-semibold tabular-nums"
                          style={{ color: cell.textColor }}
                        >
                          {cell.label}
                        </p>
                        <p className="mt-0.5 text-[10px] text-zinc-300">
                          {cell.rowWins}-{cell.opponentWins}
                        </p>
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          {cell.games} match{cell.games > 1 ? "s" : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-700">0</span>
                    )}

                    {!samePlayer && cell && cell.exists && cell.rivalry && (
                      <div className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-50 hidden w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.55)] group-hover:block">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Lecture depuis la ligne
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {rowPlayer} vs {columnPlayer}
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <TooltipStat label="Matchs" value={cell.games} />
                          <TooltipStat
                            label="Bilan"
                            value={`${cell.rowWins}-${cell.opponentWins}`}
                          />
                          <TooltipStat label="Win rate" value={`${cell.rowWinRate}%`} />
                          <TooltipStat
                            label="Statut"
                            value={getCellToneLabel(cell.tone)}
                          />
                        </div>

                        <p className="mt-3 text-xs text-zinc-400">
                          Donnée source : {cell.rivalry.playerA}{" "}
                          {cell.rivalry.winsA}-{cell.rivalry.winsB}{" "}
                          {cell.rivalry.playerB}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:hidden">
        {rivalries.map((rivalry, index) => (
          <MobileHeatmapRow
            key={`${rivalry.playerA}-${rivalry.playerB}-${index}`}
            rivalry={rivalry}
            maxGames={maxGames}
          />
        ))}
      </div>
    </div>
  );
}

function MobileHeatmapRow({
  rivalry,
  maxGames,
}: {
  rivalry: Rivalry;
  maxGames: number;
}) {
  const cellA = getHeatCell(rivalry, rivalry.playerA, maxGames);
  const cellB = getHeatCell(rivalry, rivalry.playerB, maxGames);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {rivalry.playerA} vs {rivalry.playerB}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {rivalry.games} confrontation{rivalry.games > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div
          className="rounded-xl border border-white/10 p-3"
          style={{ backgroundColor: cellA.backgroundColor }}
        >
          <p className="truncate text-xs text-zinc-400">{rivalry.playerA}</p>
          <p className="mt-1 text-lg font-semibold" style={{ color: cellA.textColor }}>
            {cellA.label}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {cellA.rowWins}-{cellA.opponentWins}
          </p>
        </div>

        <div
          className="rounded-xl border border-white/10 p-3"
          style={{ backgroundColor: cellB.backgroundColor }}
        >
          <p className="truncate text-xs text-zinc-400">{rivalry.playerB}</p>
          <p className="mt-1 text-lg font-semibold" style={{ color: cellB.textColor }}>
            {cellB.label}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {cellB.rowWins}-{cellB.opponentWins}
          </p>
        </div>
      </div>
    </article>
  );
}

function RivalryCard({
  rivalry,
  selectedPlayer,
}: {
  rivalry: Rivalry;
  selectedPlayer: string;
}) {
  const display = getDisplayRivalry(rivalry, selectedPlayer);
  const visual = getRivalryVisualTone(display);
  const dominant = getDominationLabel(display);

  const totalGames = Math.max(1, display.games);
  const unresolvedGames = Math.max(0, display.games - display.winsA - display.winsB);

  const winsAWidth = (display.winsA / totalGames) * 100;
  const winsBWidth = (display.winsB / totalGames) * 100;
  const unresolvedWidth = (unresolvedGames / totalGames) * 100;

  const playerAIsDominant = display.winsA > display.winsB;
  const playerBIsDominant = display.winsB > display.winsA;

  const playerAColor = playerAIsDominant
    ? visual.dominantBarColor
    : playerBIsDominant
      ? visual.dominatedBarColor
      : visual.neutralBarColor;

  const playerBColor = playerBIsDominant
    ? visual.dominantBarColor
    : playerAIsDominant
      ? visual.dominatedBarColor
      : visual.neutralBarColor;

  const winrateA = getWinRate(display.winsA, display.games);
  const winrateB = getWinRate(display.winsB, display.games);

  return (
    <article
      className="relative overflow-hidden rounded-[1.75rem] border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] transition hover:bg-white/[0.035] sm:p-6"
      style={{
        borderColor: visual.borderColor,
        background:
          `linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018)), ${visual.backgroundColor}`,
      }}
    >
      <div
        className="absolute right-[-70px] top-[-70px] h-40 w-40 rounded-full blur-3xl"
        style={{ backgroundColor: visual.glowColor }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Rivalité
          </p>
          <h2 className="mt-2 truncate text-lg font-semibold text-white">
            {display.playerA} vs {display.playerB}
          </h2>
        </div>

        <span
          className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium"
          style={{
            borderColor: visual.pillBorder,
            backgroundColor: visual.pillBackground,
            color: visual.pillText,
          }}
        >
          {normalizeIntensity(display.intensity)}
        </span>
      </div>

      <div className="relative mt-6">
        <div className="flex justify-between gap-3 text-xs text-zinc-400">
          <span className="truncate">
            {display.playerA} · {winrateA}%
          </span>
          <span className="truncate text-right">
            {display.playerB} · {winrateB}%
          </span>
        </div>

        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/[0.075]">
          <div
            className="h-full"
            style={{
              width: `${winsAWidth}%`,
              backgroundColor: playerAColor,
            }}
            title={`${display.playerA} : ${display.winsA} victoire(s)`}
          />

          {unresolvedWidth > 0 && (
            <div
              className="h-full"
              style={{
                width: `${unresolvedWidth}%`,
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(148,163,184,0.62) 0 6px, rgba(148,163,184,0.32) 6px 12px)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
              }}
              title={`${unresolvedGames} match(s) nul(s) ou résultat(s) indéterminé(s)`}
            />
          )}

          <div
            className="h-full"
            style={{
              width: `${winsBWidth}%`,
              backgroundColor: playerBColor,
            }}
            title={`${display.playerB} : ${display.winsB} victoire(s)`}
          />
        </div>

        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-600">
          <span>
            {playerAIsDominant ? "Dominant" : playerBIsDominant ? "Dominé" : "Égalité duel"}
          </span>
          {unresolvedGames > 0 && (
            <span className="text-zinc-500">
              {unresolvedGames} match{unresolvedGames > 1 ? "s" : ""} nul / indét.
            </span>
          )}
          <span>
            {playerBIsDominant ? "Dominant" : playerAIsDominant ? "Dominé" : "Égalité duel"}
          </span>
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-3">
        <SmallStat label="Matchs" value={display.games} />
        <SmallStat label="Victoires" value={`${display.winsA}-${display.winsB}`} />
        <SmallStat label="Dominant" value={dominant} />
      </div>

      <p className="relative mt-5 text-sm leading-6 text-zinc-400">
        {getRivalryNarrative(display)}
      </p>
    </article>
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useCloseOnOutsideClick(containerRef, () => setOpen(false));

  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase())
  );

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
        className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 text-left text-sm font-semibold text-white outline-none transition hover:border-red-400/40 focus:border-red-400/60"
      >
        <span className="truncate">{selectedOption?.label ?? "Sélectionner"}</span>
        <span className="shrink-0 text-xs text-zinc-500">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[80] w-full min-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#020617] shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          {options.length > 8 && (
            <div className="border-b border-white/10 p-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher..."
                autoFocus
                className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm font-medium text-white outline-none transition placeholder:text-zinc-600 hover:border-red-400/40 focus:border-red-400/60"
              />
            </div>
          )}

          <div className="max-h-72 overflow-y-auto p-2 [scrollbar-color:rgba(248,113,113,0.55)_rgba(255,255,255,0.05)] [scrollbar-width:thin]">
            {filteredOptions.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setSearch("");
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    selected
                      ? "bg-red-400/12 text-red-100 ring-1 ring-red-400/25"
                      : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                  ].join(" ")}
                >
                  <span className="truncate">{option.label}</span>
                  {selected && <span className="shrink-0 text-xs text-red-200">✓</span>}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">
                Aucun résultat.
              </div>
            )}
          </div>
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

function KpiCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: "blue" | "red" | "amber";
}) {
  const toneClass = {
    blue: "text-blue-300",
    red: "text-red-300",
    amber: "text-amber-300",
  }[tone];

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-4 line-clamp-2 text-2xl font-semibold leading-tight text-white">
        {value || "—"}
      </p>
      <p className={`mt-3 text-xs ${toneClass}`}>{subtitle}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function TooltipStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
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

function HeatLegendItem({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-zinc-300">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </div>
  );
}


function getDisplayRivalry(rivalry: Rivalry, selectedPlayer: string): Rivalry {
  if (selectedPlayer !== "all") {
    if (normalizeName(rivalry.playerA) === normalizeName(selectedPlayer)) {
      return rivalry;
    }

    if (normalizeName(rivalry.playerB) === normalizeName(selectedPlayer)) {
      return reverseRivalry(rivalry);
    }

    return rivalry;
  }

  if (rivalry.winsA > rivalry.winsB) {
    return rivalry;
  }

  if (rivalry.winsB > rivalry.winsA) {
    return reverseRivalry(rivalry);
  }

  return rivalry.playerA.localeCompare(rivalry.playerB, "fr") <= 0
    ? rivalry
    : reverseRivalry(rivalry);
}

function reverseRivalry(rivalry: Rivalry): Rivalry {
  return {
    ...rivalry,
    playerA: rivalry.playerB,
    playerB: rivalry.playerA,
    winsA: rivalry.winsB,
    winsB: rivalry.winsA,
    domination:
      rivalry.domination === rivalry.playerA
        ? rivalry.playerB
        : rivalry.domination === rivalry.playerB
          ? rivalry.playerA
          : rivalry.domination,
  };
}


function RivalryLegendItem({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-zinc-300">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

function getRivalryVisualTone(rivalry: Rivalry) {
  const games = Math.max(1, rivalry.games);

  const confidence = games >= 10 ? "high" : games >= 4 ? "medium" : "low";

  const alpha = confidence === "high" ? 0.32 : confidence === "medium" ? 0.22 : 0.13;
  const dominantAlpha = confidence === "high" ? 0.92 : confidence === "medium" ? 0.78 : 0.62;
  const dominatedAlpha = confidence === "high" ? 0.82 : confidence === "medium" ? 0.66 : 0.5;
  const neutralAlpha = confidence === "high" ? 0.58 : confidence === "medium" ? 0.48 : 0.38;

  if (rivalry.winsA > rivalry.winsB) {
    return {
      backgroundColor: `rgba(16, 185, 129, ${alpha})`,
      borderColor: `rgba(16, 185, 129, ${0.18 + alpha})`,
      glowColor: `rgba(16, 185, 129, ${0.16 + alpha})`,
      pillBackground: `rgba(16, 185, 129, 0.13)`,
      pillBorder: `rgba(16, 185, 129, 0.34)`,
      pillText: "#a7f3d0",
      dominantBarColor: `rgba(16, 185, 129, ${dominantAlpha})`,
      dominatedBarColor: `rgba(244, 63, 94, ${dominatedAlpha})`,
      neutralBarColor: `rgba(148, 163, 184, ${neutralAlpha})`,
    };
  }

  if (rivalry.winsA < rivalry.winsB) {
    return {
      backgroundColor: `rgba(244, 63, 94, ${alpha})`,
      borderColor: `rgba(244, 63, 94, ${0.18 + alpha})`,
      glowColor: `rgba(244, 63, 94, ${0.16 + alpha})`,
      pillBackground: `rgba(244, 63, 94, 0.13)`,
      pillBorder: `rgba(244, 63, 94, 0.34)`,
      pillText: "#fecdd3",
      dominantBarColor: `rgba(16, 185, 129, ${dominantAlpha})`,
      dominatedBarColor: `rgba(244, 63, 94, ${dominatedAlpha})`,
      neutralBarColor: `rgba(148, 163, 184, ${neutralAlpha})`,
    };
  }

  return {
    backgroundColor: "rgba(59, 130, 246, 0.105)",
    borderColor: "rgba(96, 165, 250, 0.26)",
    glowColor: "rgba(96, 165, 250, 0.14)",
    pillBackground: "rgba(96, 165, 250, 0.12)",
    pillBorder: "rgba(96, 165, 250, 0.28)",
    pillText: "#bfdbfe",
    dominantBarColor: "rgba(96, 165, 250, 0.78)",
    dominatedBarColor: "rgba(96, 165, 250, 0.48)",
    neutralBarColor: "rgba(148, 163, 184, 0.46)",
  };
}


function getPlayerName(player: Player) {
  return player.name ?? player.Nom ?? player.nom ?? "";
}

function getRivalryBetween(rivalries: Rivalry[], playerA: string, playerB: string) {
  const normalizedA = normalizeName(playerA);
  const normalizedB = normalizeName(playerB);

  return rivalries.find((rivalry) => {
    const rivalryA = normalizeName(rivalry.playerA);
    const rivalryB = normalizeName(rivalry.playerB);

    return (
      (rivalryA === normalizedA && rivalryB === normalizedB) ||
      (rivalryA === normalizedB && rivalryB === normalizedA)
    );
  });
}

function getHeatCell(
  rivalry: Rivalry | undefined,
  rowPlayer: string,
  maxGames: number
): HeatCell {
  if (!rivalry || !rivalry.games || rivalry.games <= 0) {
    return {
      exists: false,
      games: 0,
      rowWins: 0,
      opponentWins: 0,
      rowWinRate: 0,
      opponentWinRate: 0,
      tone: "empty",
      backgroundColor: "rgba(255,255,255,0.025)",
      textColor: "rgba(161,161,170,0.45)",
      borderColor: "rgba(255,255,255,0.05)",
      label: "0",
    };
  }

  const rowIsA = normalizeName(rivalry.playerA) === normalizeName(rowPlayer);
  const rowWins = rowIsA ? rivalry.winsA : rivalry.winsB;
  const opponentWins = rowIsA ? rivalry.winsB : rivalry.winsA;
  const rowWinRate = getWinRate(rowWins, rivalry.games);
  const opponentWinRate = getWinRate(opponentWins, rivalry.games);
  const gap = Math.abs(rowWins - opponentWins);

  if (rowWins > opponentWins) {
    return {
      exists: true,
      games: rivalry.games,
      rowWins,
      opponentWins,
      rowWinRate,
      opponentWinRate,
      tone: "dominant",
      backgroundColor: getDominanceColor("dominant", rowWinRate, gap, rivalry.games, maxGames),
      textColor: "#bbf7d0",
      borderColor: "rgba(34,197,94,0.28)",
      label: `${rowWinRate}%`,
      rivalry,
    };
  }

  if (rowWins < opponentWins) {
    return {
      exists: true,
      games: rivalry.games,
      rowWins,
      opponentWins,
      rowWinRate,
      opponentWinRate,
      tone: "dominated",
      backgroundColor: getDominanceColor("dominated", rowWinRate, gap, rivalry.games, maxGames),
      textColor: "#fecaca",
      borderColor: "rgba(239,68,68,0.28)",
      label: `${rowWinRate}%`,
      rivalry,
    };
  }

  return {
    exists: true,
    games: rivalry.games,
    rowWins,
    opponentWins,
    rowWinRate,
    opponentWinRate,
    tone: "balanced",
    backgroundColor: getDominanceColor("balanced", rowWinRate, gap, rivalry.games, maxGames),
    textColor: "#e5e7eb",
    borderColor: "rgba(255,255,255,0.12)",
    label: `${rowWinRate}%`,
    rivalry,
  };
}

function getDominanceColor(
  tone: "dominant" | "dominated" | "balanced",
  winRate: number,
  gap: number,
  games: number,
  maxGames: number
) {
  const volumeRatio = games / Math.max(1, maxGames);
  const volumeBoost = Math.min(0.2, volumeRatio * 0.2);
  const gapBoost = Math.min(0.18, gap * 0.05);
  const rateBoost = Math.min(0.22, Math.abs(winRate - 50) / 100);
  const alpha = Math.min(0.76, 0.24 + volumeBoost + gapBoost + rateBoost);

  if (tone === "dominant") {
    return `rgba(34, 197, 94, ${alpha})`;
  }

  if (tone === "dominated") {
    return `rgba(239, 68, 68, ${alpha})`;
  }

  return `rgba(255, 255, 255, ${Math.min(0.16, 0.06 + volumeBoost)})`;
}

function getWinRate(wins: number, games: number) {
  if (!games || games <= 0) return 0;
  return Math.round((wins / games) * 100);
}

function getDominationGap(rivalry: Rivalry) {
  return Math.abs(Number(rivalry.winsA ?? 0) - Number(rivalry.winsB ?? 0));
}

function getDominationLabel(rivalry: Rivalry) {
  if (rivalry.winsA > rivalry.winsB) return rivalry.playerA;
  if (rivalry.winsB > rivalry.winsA) return rivalry.playerB;
  return "Équilibré";
}

function normalizeIntensity(intensity?: string) {
  if (!intensity) return "Faible";

  const value = String(intensity).trim();

  if (value.toLowerCase() === "forte") return "Forte";
  if (value.toLowerCase() === "moyenne") return "Moyenne";
  if (value.toLowerCase() === "faible") return "Faible";

  return value;
}

function getIntensityScore(intensity?: string) {
  const normalized = normalizeIntensity(intensity);

  if (normalized === "Forte") return 3;
  if (normalized === "Moyenne") return 2;
  return 1;
}

function getShortName(name: string) {
  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 8);
  }

  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`.slice(0, 10);
}

function getCellToneLabel(tone: HeatCell["tone"]) {
  if (tone === "dominant") return "Dominant";
  if (tone === "dominated") return "Dominé";
  if (tone === "balanced") return "Équilibré";
  return "Aucun match";
}

function getRivalryNarrative(rivalry: Rivalry) {
  const gap = getDominationGap(rivalry);

  if (gap === 0) {
    return `Cette rivalité est équilibrée après ${rivalry.games} confrontation${
      rivalry.games > 1 ? "s" : ""
    }.`;
  }

  const dominant = rivalry.winsA > rivalry.winsB ? rivalry.playerA : rivalry.playerB;

  return `${dominant} domine actuellement ce duel avec ${gap} victoire${
    gap > 1 ? "s" : ""
  } d’écart sur ${rivalry.games} confrontation${
    rivalry.games > 1 ? "s" : ""
  }.`;
}

function normalizeName(value: string) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
