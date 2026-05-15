export type DatasetHealthIssueSeverity = "error" | "warning" | "info";

export type DatasetHealthIssue = {
  id: string;
  title: string;
  description: string;
  severity: DatasetHealthIssueSeverity;
  count: number;
  gameIds: string[];
};

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

export function buildSkyjoDatasetHealth({
  games,
  players,
}: {
  games: any[];
  players: any[];
}) {
  const issues: DatasetHealthIssue[] = [];

  const activePlayerIds = new Set(
    players
      .filter((player) => player.status !== "Inactif" && player.is_active !== false)
      .map((player) => asText(player.joueurId ?? player.joueur_id ?? player.id))
      .filter(Boolean)
  );

  const allPlayerIds = new Set(
    players
      .map((player) => asText(player.joueurId ?? player.joueur_id ?? player.id))
      .filter(Boolean)
  );

  function addIssue(issue: Omit<DatasetHealthIssue, "count">) {
    const uniqueGameIds = Array.from(new Set(issue.gameIds.filter(Boolean)));

    if (uniqueGameIds.length === 0) return;

    issues.push({
      ...issue,
      gameIds: uniqueGameIds,
      count: uniqueGameIds.length,
    });
  }

  addIssue({
    id: "missing-results",
    title: "Parties sans résultat",
    description: "Certaines parties n’ont aucun résultat associé.",
    severity: "error",
    gameIds: games
      .filter((game) => !Array.isArray(game.results) || game.results.length === 0)
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "missing-location",
    title: "Lieu manquant",
    description: "Certaines parties n’ont pas de lieu renseigné.",
    severity: "warning",
    gameIds: games
      .filter((game) => !asText(game.location))
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "missing-date",
    title: "Date manquante ou invalide",
    description: "Certaines parties ont une date absente ou invalide.",
    severity: "error",
    gameIds: games
      .filter((game) => {
        const value = game.dateIso ?? game.played_at ?? game.date;
        return !value || Number.isNaN(new Date(value).getTime());
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "player-count-mismatch",
    title: "Nombre de joueurs incohérent",
    description: "Le nombre de résultats ne correspond pas au nombre de joueurs annoncé.",
    severity: "warning",
    gameIds: games
      .filter((game) => {
        const expected = asNumber(game.expected_players_count ?? game.expectedPlayersCount);
        const actual = Array.isArray(game.results) ? game.results.length : 0;

        return expected !== null && actual > 0 && expected !== actual;
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "duplicate-player-in-game",
    title: "Joueur présent plusieurs fois",
    description: "Un même joueur apparaît plusieurs fois dans une même partie.",
    severity: "error",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];
        const ids = results.map((result: any) =>
          asText(result.playerId ?? result.player_id ?? result.player?.joueur_id ?? result.player?.id)
        );

        return ids.some((id: any, index: any) => id && ids.indexOf(id) !== index);
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "unknown-player",
    title: "Joueur inconnu",
    description: "Certains résultats référencent un joueur absent de la table joueurs.",
    severity: "error",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];

        return results.some((result: any) => {
          const playerId = asText(
            result.playerId ?? result.player_id ?? result.player?.joueur_id ?? result.player?.id
          );

          return playerId && !allPlayerIds.has(playerId);
        });
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "inactive-player-used",
    title: "Joueur inactif utilisé",
    description: "Certaines parties contiennent un joueur marqué comme inactif.",
    severity: "info",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];

        return results.some((result: any) => {
          const playerId = asText(
            result.playerId ?? result.player_id ?? result.player?.joueur_id ?? result.player?.id
          );

          return playerId && allPlayerIds.has(playerId) && !activePlayerIds.has(playerId);
        });
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "missing-score",
    title: "Score manquant",
    description: "Certains résultats n’ont pas de score renseigné.",
    severity: "error",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];
        return results.some((result: any) => result.score === null || result.score === undefined || result.score === "");
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "invalid-score",
    title: "Score invalide",
    description: "Certains scores ne sont pas numériques.",
    severity: "error",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];
        return results.some((result: any) => asNumber(result.score) === null);
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "very-high-score",
    title: "Score très élevé",
    description: "Certains scores semblent anormalement élevés pour une partie de Skyjo.",
    severity: "info",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];
        return results.some((result: any) => {
          const score = asNumber(result.score);
          return score !== null && score > 200;
        });
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "missing-position",
    title: "Position manquante",
    description: "Certains résultats n’ont pas de position renseignée.",
    severity: "warning",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];
        return results.some((result: any) => asNumber(result.position) === null);
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "position-score-mismatch",
    title: "Classement incohérent avec les scores",
    description:
        "Les positions enregistrées ne correspondent pas à l’ordre des scores.",

    severity: "error",

    gameIds: games
        .filter((game) => {
        const results = Array.isArray(game.results)
            ? game.results
            : [];

        const rows = results
            .map((result: any) => ({
            score: asNumber(
                result.score ??
                result.Score
            ),
            position: asNumber(
                result.position ??
                result.Position ??
                result.rank ??
                result.Rang
            ),
            }))
            .filter(
            (row: { score: null; position: null; }) =>
                row.score !== null &&
                row.position !== null
            );

        if (rows.length < 2) {
            return false;
        }

        const sortedByScore = [...rows].sort(
            (a, b) => a.score - b.score
        );

        let previousScore: number | null = null;
        let previousPosition = 0;

        return sortedByScore.some((row) => {
            const expectedPosition =
            previousScore !== null &&
            row.score === previousScore
                ? previousPosition
                : previousPosition + 1;

            previousScore = row.score;
            previousPosition = expectedPosition;

            return row.position !== expectedPosition;
        });
        })
        .map((game) =>
        asText(
            game.partieId ??
            game.partie_id ??
            game.id
        )
        ),
    });

  addIssue({
    id: "explicit-winner-mismatch",
    title: "Gagnant explicite incohérent",
    description: "Une ligne marquée gagnante ne correspond pas au meilleur score.",
    severity: "error",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];
        const scores = results.map((result: any) => asNumber(result.score)).filter((score: null) => score !== null) as number[];

        if (scores.length === 0) return false;

        const bestScore = Math.min(...scores);

        return results.some((result: any) => {
          const score = asNumber(result.score);
          const explicitWinner = result.isWinner === true || result.is_winner === true || result.winner === true;

          return explicitWinner && score !== bestScore;
        });
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "multiple-explicit-winners",
    title: "Plusieurs gagnants explicites",
    description: "Certaines parties contiennent plusieurs lignes marquées comme gagnantes. Ce n’est acceptable que si les scores sont ex æquo.",
    severity: "warning",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];

        const explicitWinners = results.filter((result: any) =>
          result.isWinner === true || result.is_winner === true || result.winner === true
        );

        if (explicitWinners.length <= 1) return false;

        const winnerScores = explicitWinners
          .map((result: any) => asNumber(result.score))
          .filter((score: null) => score !== null);

        return new Set(winnerScores).size > 1;
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "best-score-not-position-one",
    title: "Meilleur score non classé #1",
    description: "Le meilleur score de la partie n’est pas associé à la position #1.",
    severity: "error",
    gameIds: games
      .filter((game) => {
        const results = Array.isArray(game.results) ? game.results : [];
        const scores = results.map((result: any) => asNumber(result.score)).filter((score: null) => score !== null) as number[];

        if (scores.length === 0) return false;

        const bestScore = Math.min(...scores);

        return results.some((result: any) => {
          const score = asNumber(result.score);
          const position = asNumber(result.position);

          return score === bestScore && position !== 1;
        });
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  addIssue({
    id: "duplicate-game-id",
    title: "ID partie dupliqué",
    description: "Plusieurs parties partagent le même identifiant fonctionnel.",
    severity: "error",
    gameIds: games
      .filter((game, index) => {
        const id = asText(game.partieId ?? game.partie_id);
        if (!id) return false;

        return games.findIndex((other) => asText(other.partieId ?? other.partie_id) === id) !== index;
      })
      .map((game) => asText(game.partieId ?? game.partie_id ?? game.id)),
  });

  return {
    status: issues.some((issue) => issue.severity === "error")
      ? "error"
      : issues.some((issue) => issue.severity === "warning")
        ? "warning"
        : "ok",
    issues,
  };
}