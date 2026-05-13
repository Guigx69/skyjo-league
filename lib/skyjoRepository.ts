import "server-only";

import { createClient } from "@supabase/supabase-js";

export type SkyjoDataSourceMode = "legacy" | "relational" | "hybrid";

export interface SkyjoRepository {
  getPlayers(): Promise<any[]>;
  getGames(): Promise<any[]>;
  getRivalries(): Promise<any[]>;
  getSeasons(): Promise<any[]>;
  getFullDataset(): Promise<{
    players: any[];
    games: any[];
    rivalries: any[];
    seasons: any[];
  }>;
}

function toDataSourceMode(raw: string | undefined): SkyjoDataSourceMode {
  if (raw === "legacy" || raw === "relational" || raw === "hybrid") {
    return raw;
  }

  return "legacy";
}

function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function numberOrZero(value: unknown): number {
  return toNumber(value) ?? 0;
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function formatDateFr(value: string | null | undefined): string {
  if (!value) return "Date inconnue";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("fr-FR");
}

function getDateTimestamp(value: string | null | undefined): number {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getSeasonFromDate(value: string | null | undefined) {
  if (!value) {
    return {
      seasonId: "UNKNOWN",
      seasonName: "Saison inconnue",
      seasonPeriod: "Date inconnue",
      sortIndex: -1,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      seasonId: "UNKNOWN",
      seasonName: "Saison inconnue",
      seasonPeriod: "Date inconnue",
      sortIndex: -1,
    };
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (year < 2026 || (year === 2026 && month < 4)) {
    return {
      seasonId: "S00",
      seasonName: "Pré-saison",
      seasonPeriod: "Avant Avril 2026",
      sortIndex: 0,
    };
  }

  const monthsSinceApril2026 = (year - 2026) * 12 + (month - 4);
  const seasonIndex = Math.floor(monthsSinceApril2026 / 3) + 1;
  const seasonId = `S${String(seasonIndex).padStart(2, "0")}`;

  return {
    seasonId,
    seasonName: `Saison ${String(seasonIndex).padStart(2, "0")}`,
    seasonPeriod: `Trimestre ${seasonIndex}`,
    sortIndex: seasonIndex,
  };
}

function normalizeResult(result: any) {
  const player = result.player && typeof result.player === "object"
    ? result.player
    : null;

  const name =
    result.playerName ??
    result.JoueurNom ??
    result.joueurNom ??
    result.name ??
    result.player ??
    result.nom ??
    result.Nom ??
    player?.display_name;

  const score = toNumber(result.score ?? result.Score);

  const position = toNumber(
    result.position ?? result.Position ?? result.rank ?? result.Rang
  );

  return {
    name: name ? String(name).trim() : "",
    playerId: asText(
      result.playerId ??
        result.player_id ??
        player?.joueur_id ??
        player?.id
    ),
    score,
    position,
    isWinner:
      result.isWinner === true ||
      result.winner === true ||
      result.win === true ||
      result.victoire === true ||
      result.is_winner === true ||
      position === 1,
  };
}

function getDuelWinner(playerA: any, playerB: any) {
  if (playerA.isWinner && !playerB.isWinner) return playerA.name;
  if (playerB.isWinner && !playerA.isWinner) return playerB.name;

  if (typeof playerA.position === "number" && typeof playerB.position === "number") {
    if (playerA.position < playerB.position) return playerA.name;
    if (playerB.position < playerA.position) return playerB.name;
    return null;
  }

  if (typeof playerA.score === "number" && typeof playerB.score === "number") {
    if (playerA.score < playerB.score) return playerA.name;
    if (playerB.score < playerA.score) return playerB.name;
    return null;
  }

  return null;
}

function getRivalryIntensity(games: number, gap: number) {
  if (games >= 10 || gap >= 5) return "Forte";
  if (games >= 4 || gap >= 2) return "Moyenne";
  return "Faible";
}

function buildRivalriesFromGames(games: any[]) {
  const rivalryMap = new Map<string, any>();

  games.forEach((game) => {
    const results = Array.isArray(game.results) ? game.results : [];

    const normalizedResults = results
      .map((result: any) => normalizeResult(result))
      .filter((result: any) => result.name);

    if (normalizedResults.length < 2) return;

    for (let i = 0; i < normalizedResults.length; i += 1) {
      for (let j = i + 1; j < normalizedResults.length; j += 1) {
        const playerA = normalizedResults[i];
        const playerB = normalizedResults[j];

        const names = [playerA.name, playerB.name].sort((a, b) =>
          a.localeCompare(b, "fr")
        );

        const key = `${names[0]}__${names[1]}`;

        if (!rivalryMap.has(key)) {
          rivalryMap.set(key, {
            playerA: names[0],
            playerB: names[1],
            games: 0,
            winsA: 0,
            winsB: 0,
          });
        }

        const rivalry = rivalryMap.get(key);
        rivalry.games += 1;

        const winner = getDuelWinner(playerA, playerB);

        if (winner === rivalry.playerA) rivalry.winsA += 1;
        if (winner === rivalry.playerB) rivalry.winsB += 1;
      }
    }
  });

  return Array.from(rivalryMap.values())
    .map((rivalry) => {
      const gap = Math.abs(rivalry.winsA - rivalry.winsB);

      return {
        ...rivalry,
        domination:
          rivalry.winsA > rivalry.winsB
            ? rivalry.playerA
            : rivalry.winsB > rivalry.winsA
              ? rivalry.playerB
              : "Équilibré",
        intensity: getRivalryIntensity(rivalry.games, gap),
      };
    })
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;

      return Math.abs(b.winsA - b.winsB) - Math.abs(a.winsA - a.winsB);
    });
}

function normalizePlayer(player: any, index: number, statsByJoueurId: Map<string, any>) {
  const joueurId = asText(player.joueur_id);
  const stats = statsByJoueurId.get(joueurId);

  return {
    id: index + 1,
    joueurId,
    rank: index + 1,
    name: asText(player.display_name),
    email: asText(player.email),
    elo: 1000,
    winRate: stats?.games ? Math.round((stats.wins / stats.games) * 100) : 0,
    games: stats?.games ?? 0,
    avgScore: stats?.games ? Math.round(stats.totalScore / stats.games) : 0,
    bestScore: stats?.bestScore ?? 0,
    form: "—",
    badge: stats?.wins ? "Compétiteur" : "En progression",
    status: player.is_active === false ? "Inactif" : "Actif",
  };
}

function normalizeGame(game: any, index: number) {
  const results = Array.isArray(game.results)
    ? game.results
        .map((result: any) => {
          const player = result.player;

          return {
            playerId: asText(player?.joueur_id ?? result.player_id),
            playerName: asText(player?.display_name),
            score: numberOrZero(result.score),
            position: numberOrZero(result.position),
          };
        })
        .sort((a: any, b: any) => {
          if (a.position !== b.position) return a.position - b.position;
          return a.score - b.score;
        })
    : [];

  const scores = results.map((result: any) => result.score);
  const winner = results.find((result: any) => result.position === 1)?.playerName ?? "";

  const season = getSeasonFromDate(game.played_at);

  return {
    id: index + 1,
    partieId: asText(game.partie_id),
    date: formatDateFr(game.played_at),
    dateIso: asText(game.played_at),
    dateTimestamp: getDateTimestamp(game.played_at),
    sortIndex: index + 1,
    location: asText(game.location),
    players: results.length,
    winner,
    bestScore: scores.length ? Math.min(...scores) : 0,
    worstScore: scores.length ? Math.max(...scores) : 0,
    status: "Terminée",
    seasonId: season.seasonId,
    seasonName: season.seasonName,
    seasonPeriod: season.seasonPeriod,
    results,
  };
}

function buildPlayerStatsFromGames(games: any[]) {
  const stats = new Map<string, any>();

  games.forEach((game) => {
    const results = Array.isArray(game.results) ? game.results : [];

    results.forEach((result: any) => {
      const joueurId = asText(result.playerId);
      if (!joueurId) return;

      if (!stats.has(joueurId)) {
        stats.set(joueurId, {
          games: 0,
          wins: 0,
          totalScore: 0,
          bestScore: null,
        });
      }

      const row = stats.get(joueurId);

      row.games += 1;
      row.totalScore += numberOrZero(result.score);

      if (result.position === 1) {
        row.wins += 1;
      }

      if (row.bestScore === null || result.score < row.bestScore) {
        row.bestScore = result.score;
      }
    });
  });

  return stats;
}

function buildSeasonsFromGames(games: any[]) {
  const seasons = new Map<string, any>();

  games.forEach((game) => {
    const seasonId = game.seasonId ?? "UNKNOWN";

    if (!seasons.has(seasonId)) {
      seasons.set(seasonId, {
        id: seasonId,
        name: game.seasonName ?? "Saison inconnue",
        period: game.seasonPeriod ?? "",
        games: 0,
        players: 0,
        leader: "—",
        status: "Active",
        sortIndex: game.sortIndex ?? 0,
      });
    }

    const season = seasons.get(seasonId);
    season.games += 1;
    season.players = Math.max(season.players, game.players ?? 0);
  });

  return Array.from(seasons.values()).sort((a, b) => a.sortIndex - b.sortIndex);
}

export const legacyJsonRepository: SkyjoRepository = {
  async getPlayers() {
    return (await this.getFullDataset()).players;
  },

  async getGames() {
    return (await this.getFullDataset()).games;
  },

  async getRivalries() {
    return (await this.getFullDataset()).rivalries;
  },

  async getSeasons() {
    return (await this.getFullDataset()).seasons;
  },

  async getFullDataset() {
    const supabase = getServerSupabaseClient();

    const { data: row, error } = await supabase
      .from("skyjo_dataset")
      .select("data")
      .eq("id", "active")
      .maybeSingle();

    if (error) throw error;

    const dataset = (row?.data as any) ?? {};
    const games = Array.isArray(dataset.games) ? dataset.games : [];

    return {
      players: Array.isArray(dataset.players) ? dataset.players : [],
      games,
      rivalries: buildRivalriesFromGames(games),
      seasons: Array.isArray(dataset.seasons) ? dataset.seasons : [],
    };
  },
};

export const relationalRepository: SkyjoRepository = {
  async getPlayers() {
    const dataset = await this.getFullDataset();
    return dataset.players;
  },

  async getGames() {
    const dataset = await this.getFullDataset();
    return dataset.games;
  },

  async getRivalries() {
    const dataset = await this.getFullDataset();
    return dataset.rivalries;
  },

  async getSeasons() {
    const dataset = await this.getFullDataset();
    return dataset.seasons;
  },

  async getFullDataset() {
    const supabase = getServerSupabaseClient();

    const { data: rawGames, error: gamesError } = await supabase
      .from("skyjo_games")
      .select(
        `
        *,
        results:skyjo_game_results(
          *,
          player:skyjo_players(*)
        )
      `
      )
      .order("played_at", { ascending: false });

    if (gamesError) throw gamesError;

    const games = (rawGames ?? []).map((game, index) =>
      normalizeGame(game, index)
    );

    const statsByJoueurId = buildPlayerStatsFromGames(games);

    const { data: rawPlayers, error: playersError } = await supabase
      .from("skyjo_players")
      .select("*")
      .order("display_name", { ascending: true });

    if (playersError) throw playersError;

    const players = (rawPlayers ?? []).map((player, index) =>
      normalizePlayer(player, index, statsByJoueurId)
    );

    return {
      players,
      games,
      rivalries: buildRivalriesFromGames(games),
      seasons: buildSeasonsFromGames(games),
    };
  },
};

export const hybridRepository: SkyjoRepository = {
  async getPlayers() {
    return (await this.getFullDataset()).players;
  },

  async getGames() {
    return (await this.getFullDataset()).games;
  },

  async getRivalries() {
    return (await this.getFullDataset()).rivalries;
  },

  async getSeasons() {
    return (await this.getFullDataset()).seasons;
  },

  async getFullDataset() {
    try {
      const relationalDataset = await relationalRepository.getFullDataset();

      if (
        relationalDataset.players.length > 0 &&
        relationalDataset.games.length > 0
      ) {
        return relationalDataset;
      }
    } catch (error) {
      console.warn("Relational Skyjo repository failed, fallback to legacy.", error);
    }

    return legacyJsonRepository.getFullDataset();
  },
};

export function getSkyjoRepository(mode?: SkyjoDataSourceMode): SkyjoRepository {
  const sourceMode = mode ?? toDataSourceMode(process.env.NEXT_PUBLIC_SKYJO_DATA_SOURCE);

  if (sourceMode === "relational") return relationalRepository;
  if (sourceMode === "hybrid") return hybridRepository;

  return legacyJsonRepository;
}