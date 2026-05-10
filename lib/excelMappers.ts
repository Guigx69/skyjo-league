type RawRow = Record<string, any>;

export type AppPlayer = {
  id: number;
  joueurId: string;
  rank: number;
  name: string;
  email: string;
  elo: number;
  winRate: number;
  games: number;
  avgScore: number;
  bestScore: number;
  form: string;
  badge: string;
  status: string;
};

export type AppGameResult = {
  playerId: string;
  playerName: string;
  score: number;
  position: number;
};

export type AppGame = {
  id: number;
  partieId: string;
  date: string;
  dateIso: string;
  dateTimestamp: number;
  sortIndex: number;
  location: string;
  players: number;
  winner: string;
  bestScore: number;
  worstScore: number;
  status: string;
  seasonId: string;
  seasonName: string;
  seasonPeriod: string;
  results: AppGameResult[];
};

export type AppRivalry = {
  playerA: string;
  playerB: string;
  games: number;
  winsA: number;
  winsB: number;
  domination: string;
  intensity: string;
};

export type AppSeason = {
  id: string;
  name: string;
  period: string;
  games: number;
  players: number;
  leader: string;
  status: string;
  sortIndex: number;
};

export type MappedSkyjoData = {
  players: AppPlayer[];
  games: AppGame[];
  rivalries: AppRivalry[];
  seasons: AppSeason[];
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown) {
  const numberValue =
    typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getNumericId(value: unknown) {
  const text = normalizeText(value);
  const digits = text.replace(/\D/g, "");

  return digits ? Number(digits) : 0;
}

function parseExcelDate(value: unknown) {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + value * 86_400_000);
  }

  if (typeof value === "string") {
    const parts = value.split(/[/-]/).map(Number);

    if (parts.length === 3) {
      const [day, month, year] = parts;
      return new Date(Date.UTC(year, month - 1, day));
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatDate(date: Date | null) {
  if (!date) return "Date inconnue";

  return new Intl.DateTimeFormat("fr-FR").format(date);
}

function toIsoDate(date: Date | null) {
  if (!date) return "";

  return date.toISOString().slice(0, 10);
}

function getQuarterPeriod(year: number, quarterStartMonth: number) {
  const monthNames = [
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

  return `${monthNames[quarterStartMonth]} ${year} — ${
    monthNames[quarterStartMonth + 2]
  } ${year}`;
}

function getSeasonFromDate(date: Date | null) {
  if (!date) {
    return {
      seasonId: "UNKNOWN",
      seasonName: "Saison inconnue",
      seasonPeriod: "Date inconnue",
      sortIndex: -1,
    };
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const firstRealSeasonStart = new Date(Date.UTC(2026, 3, 1));

  if (date < firstRealSeasonStart) {
    return {
      seasonId: "S00",
      seasonName: "Pré-saison",
      seasonPeriod: "Avant Avril 2026",
      sortIndex: 0,
    };
  }

  const quartersSinceStart = (year - 2026) * 4 + Math.floor((month - 3) / 3);
  const seasonNumber = quartersSinceStart + 1;
  const normalizedSeasonNumber = String(seasonNumber).padStart(2, "0");
  const quarterStartMonth = Math.floor(month / 3) * 3;

  return {
    seasonId: `S${normalizedSeasonNumber}`,
    seasonName: `Saison ${normalizedSeasonNumber}`,
    seasonPeriod: getQuarterPeriod(year, quarterStartMonth),
    sortIndex: seasonNumber,
  };
}

function getForm(results: RawRow[]) {
  const recent = results.slice(-5);

  if (recent.length === 0) return "—";

  const wins = recent.filter((result) => toNumber(result.Position) === 1).length;
  const losses = recent.length - wins;

  if (wins >= losses) return `${wins}V`;

  return `${losses}D`;
}

function getBadge(rank: number, winRate: number, games: number) {
  if (rank === 1) return "Champion actuel";
  if (winRate >= 35) return "Très régulier";
  if (games >= 25) return "Joueur actif";

  return "En progression";
}

function computeElo(winRate: number, avgScore: number, games: number) {
  return Math.round(1000 + winRate * 4 + games * 2 - avgScore * 0.8);
}

function getPlayerEmail(joueur: RawRow) {
  return normalizeText(
    joueur.Email ??
      joueur.email ??
      joueur.Mail ??
      joueur.mail ??
      joueur.AdresseMail ??
      joueur.adresseMail ??
      joueur.Courriel ??
      joueur.courriel ??
      ""
  );
}

export function mapExcelToSkyjoData({
  joueurs,
  parties,
  resultats,
}: {
  joueurs: RawRow[];
  parties: RawRow[];
  resultats: RawRow[];
}): MappedSkyjoData {
  const resultsByPlayerId = new Map<string, RawRow[]>();
  const resultsByPartieId = new Map<string, RawRow[]>();

  for (const result of resultats) {
    const joueurId = normalizeText(result.JoueurID);
    const partieId = normalizeText(result.PartieID);

    if (!resultsByPlayerId.has(joueurId)) {
      resultsByPlayerId.set(joueurId, []);
    }

    if (!resultsByPartieId.has(partieId)) {
      resultsByPartieId.set(partieId, []);
    }

    resultsByPlayerId.get(joueurId)?.push(result);
    resultsByPartieId.get(partieId)?.push(result);
  }

  const playersUnranked = joueurs.map((joueur, index) => {
    const joueurId = normalizeText(joueur.JoueurID);
    const name = normalizeText(joueur.Nom);
    const playerResults = resultsByPlayerId.get(joueurId) ?? [];

    const games = playerResults.length;
    const wins = playerResults.filter(
      (result) => toNumber(result.Position) === 1
    ).length;

    const scores = playerResults.map((result) => toNumber(result.Score));

    const avgScore =
      scores.length > 0
        ? Math.round(
            scores.reduce((sum, score) => sum + score, 0) / scores.length
          )
        : 0;

    const bestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;
    const elo = computeElo(winRate, avgScore, games);

    return {
      id: index + 1,
      joueurId,
      rank: 0,
      name,
      email: getPlayerEmail(joueur),
      elo,
      winRate,
      games,
      avgScore,
      bestScore,
      form: getForm(playerResults),
      badge: "",
      status: "",
    };
  });

  const players = playersUnranked
    .sort((a, b) => b.elo - a.elo)
    .map((player, index) => {
      const rank = index + 1;
      const badge = getBadge(rank, player.winRate, player.games);

      return {
        ...player,
        rank,
        badge,
        status: badge,
      };
    });

  const games = parties
    .map((partie, index) => {
      const partieId = normalizeText(partie.PartieID);
      const partieResults = resultsByPartieId.get(partieId) ?? [];
      const parsedDate = parseExcelDate(partie.DatePartie);
      const season = getSeasonFromDate(parsedDate);

      const results = partieResults
        .map((result) => ({
          playerId: normalizeText(result.JoueurID),
          playerName: normalizeText(result.JoueurNom),
          score: toNumber(result.Score),
          position: toNumber(result.Position),
        }))
        .sort((a, b) => a.position - b.position);

      const sortedByPosition = [...results].sort(
        (a, b) => a.position - b.position
      );

      const winnerResult = sortedByPosition[0];
      const scores = results.map((result) => result.score);

      return {
        id: index + 1,
        partieId,
        date: formatDate(parsedDate),
        dateIso: toIsoDate(parsedDate),
        dateTimestamp: parsedDate?.getTime() ?? 0,
        sortIndex: getNumericId(partieId),
        location: normalizeText(partie.Lieu),
        players: toNumber(partie.NbJoueurs),
        winner: normalizeText(winnerResult?.playerName),
        bestScore: scores.length > 0 ? Math.min(...scores) : 0,
        worstScore: scores.length > 0 ? Math.max(...scores) : 0,
        status: "Validée",
        seasonId: season.seasonId,
        seasonName: season.seasonName,
        seasonPeriod: season.seasonPeriod,
        results,
      };
    })
    .sort((a, b) => {
      if (b.dateTimestamp !== a.dateTimestamp) {
        return b.dateTimestamp - a.dateTimestamp;
      }

      return b.sortIndex - a.sortIndex;
    });

  const seasonMap = new Map<string, AppSeason>();

  for (const game of games) {
    if (!seasonMap.has(game.seasonId)) {
      const season = getSeasonFromDate(
        game.dateTimestamp ? new Date(game.dateTimestamp) : null
      );

      seasonMap.set(game.seasonId, {
        id: game.seasonId,
        name: game.seasonName,
        period: game.seasonPeriod,
        games: 0,
        players: 0,
        leader: "—",
        status: "Terminée",
        sortIndex: season.sortIndex,
      });
    }

    const season = seasonMap.get(game.seasonId)!;
    season.games += 1;
  }

  const currentSeasonId = games[0]?.seasonId;

  const seasons = Array.from(seasonMap.values())
    .map((season) => {
      const seasonGames = games.filter((game) => game.seasonId === season.id);
      const playerNames = new Set<string>();

      for (const game of seasonGames) {
        for (const result of game.results) {
          playerNames.add(result.playerName);
        }
      }

      const winsByPlayer = new Map<string, number>();

      for (const game of seasonGames) {
        if (!game.winner) continue;
        winsByPlayer.set(game.winner, (winsByPlayer.get(game.winner) ?? 0) + 1);
      }

      const leader =
        Array.from(winsByPlayer.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        "—";

      return {
        ...season,
        players: playerNames.size,
        leader,
        status: season.id === currentSeasonId ? "Active" : "Terminée",
      };
    })
    .sort((a, b) => b.sortIndex - a.sortIndex);

  const rivalryMap = new Map<string, AppRivalry>();

  for (const [, partieResults] of resultsByPartieId) {
    for (let i = 0; i < partieResults.length; i++) {
      for (let j = i + 1; j < partieResults.length; j++) {
        const a = partieResults[i];
        const b = partieResults[j];

        const playerA = normalizeText(a.JoueurNom);
        const playerB = normalizeText(b.JoueurNom);

        if (!playerA || !playerB || playerA === playerB) continue;

        const names = [playerA, playerB].sort((left, right) =>
          left.localeCompare(right, "fr")
        );

        const key = `${names[0]}__${names[1]}`;

        if (!rivalryMap.has(key)) {
          rivalryMap.set(key, {
            playerA: names[0],
            playerB: names[1],
            games: 0,
            winsA: 0,
            winsB: 0,
            domination: "Égalité",
            intensity: "Faible",
          });
        }

        const rivalry = rivalryMap.get(key)!;
        rivalry.games += 1;

        const positionA = toNumber(a.Position);
        const positionB = toNumber(b.Position);

        if (positionA === positionB) {
          continue;
        }

        const winner = positionA < positionB ? playerA : playerB;

        if (winner === rivalry.playerA) {
          rivalry.winsA += 1;
        }

        if (winner === rivalry.playerB) {
          rivalry.winsB += 1;
        }
      }
    }
  }

  const rivalries = Array.from(rivalryMap.values())
    .map((rivalry) => {
      const maxWins = Math.max(rivalry.winsA, rivalry.winsB);
      const minWins = Math.min(rivalry.winsA, rivalry.winsB);
      const gap = maxWins - minWins;
      const drawCount = rivalry.games - rivalry.winsA - rivalry.winsB;

      return {
        ...rivalry,
        domination:
          rivalry.winsA > rivalry.winsB
            ? rivalry.playerA
            : rivalry.winsB > rivalry.winsA
              ? rivalry.playerB
              : "Égalité",
        intensity:
          rivalry.games >= 20 && gap <= 4
            ? "Forte"
            : rivalry.games >= 10 && gap <= 3
              ? "Équilibrée"
              : gap >= 8
                ? "Dominée"
                : drawCount > 0 && gap === 0
                  ? "Équilibrée"
                  : "Modérée",
      };
    })
    .sort((a, b) => b.games - a.games || Math.abs(b.winsA - b.winsB) - Math.abs(a.winsA - a.winsB));

  return {
    players,
    games,
    rivalries,
    seasons,
  };
}