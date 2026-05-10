import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useSkyjoData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDataset = async () => {
      const { data: row, error } = await supabase
        .from("skyjo_dataset")
        .select("data")
        .eq("id", "active")
        .maybeSingle();

      if (error) {
        console.error("Erreur récupération skyjo_dataset :", error);
        setLoading(false);
        return;
      }

      const dataset = row?.data ?? null;

      if (!dataset) {
        setData(null);
        setLoading(false);
        return;
      }

      setData({
        ...dataset,
        rivalries: buildRivalriesFromGames(dataset.games ?? []),
      });

      setLoading(false);
    };

    fetchDataset();
  }, []);

  return {
    data,
    loading,
    hasData: Boolean(data),
  };
}

function buildRivalriesFromGames(games: any[]) {
  const rivalryMap = new Map<string, any>();

  games.forEach((game) => {
    const results = Array.isArray(game.results) ? game.results : [];

    const normalizedResults = results
      .map((result: any) => normalizeResult(result))
      .filter((result: any) => result.name);

    if (normalizedResults.length < 2) {
      return;
    }

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

        if (winner === playerA.name) {
          if (playerA.name === rivalry.playerA) {
            rivalry.winsA += 1;
          } else {
            rivalry.winsB += 1;
          }
        }

        if (winner === playerB.name) {
          if (playerB.name === rivalry.playerA) {
            rivalry.winsA += 1;
          } else {
            rivalry.winsB += 1;
          }
        }
      }
    }
  });

  return Array.from(rivalryMap.values())
    .map((rivalry) => {
      const gap = Math.abs(rivalry.winsA - rivalry.winsB);

      const domination =
        rivalry.winsA > rivalry.winsB
          ? rivalry.playerA
          : rivalry.winsB > rivalry.winsA
            ? rivalry.playerB
            : "Équilibré";

      const intensity = getRivalryIntensity(rivalry.games, gap);

      return {
        ...rivalry,
        domination,
        intensity,
      };
    })
    .sort((a, b) => {
      if (b.games !== a.games) {
        return b.games - a.games;
      }

      return Math.abs(b.winsA - b.winsB) - Math.abs(a.winsA - a.winsB);
    });
}

function normalizeResult(result: any) {
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
    name: name ? String(name).trim() : "",
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

function getDuelWinner(playerA: any, playerB: any) {
  if (playerA.isWinner && !playerB.isWinner) {
    return playerA.name;
  }

  if (playerB.isWinner && !playerA.isWinner) {
    return playerB.name;
  }

  if (isFiniteNumber(playerA.position) && isFiniteNumber(playerB.position)) {
    if (playerA.position < playerB.position) {
      return playerA.name;
    }

    if (playerB.position < playerA.position) {
      return playerB.name;
    }

    return null;
  }

  if (isFiniteNumber(playerA.score) && isFiniteNumber(playerB.score)) {
    if (playerA.score < playerB.score) {
      return playerA.name;
    }

    if (playerB.score < playerA.score) {
      return playerB.name;
    }

    return null;
  }

  return null;
}

function getRivalryIntensity(games: number, gap: number) {
  if (games >= 10 || gap >= 5) {
    return "Forte";
  }

  if (games >= 4 || gap >= 2) {
    return "Moyenne";
  }

  return "Faible";
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}