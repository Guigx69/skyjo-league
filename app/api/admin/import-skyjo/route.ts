import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ExcelRawData = {
  joueurs: Record<string, unknown>[];
  parties: Record<string, unknown>[];
  resultats: Record<string, unknown>[];
};

type ImportBody = {
  fileName: string;
  updatedAt: string;
  updatedByEmail: string | null;
  rawData: ExcelRawData;
  appData: unknown;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function asText(value: unknown) {
  return String(value ?? "").trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function excelSerialDateToISO(serial: number) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86_400_000;

  return new Date(utcValue).toISOString().slice(0, 10);
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "number") {
    if (value > 30000 && value < 80000) {
      return excelSerialDateToISO(value);
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");

    return `${year}-${month}-${day}`;
  }

  const date = new Date(text);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return NextResponse.json(
        {
          error: "Variables Supabase manquantes.",
        },
        {
          status: 500,
        }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Session invalide.",
        },
        {
          status: 401,
        }
      );
    }

    const token = authorization.replace("Bearer ", "");

    const clientSupabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
    } = await clientSupabase.auth.getUser(token);

    if (!user?.email) {
      return NextResponse.json(
        {
          error: "Utilisateur non authentifié.",
        },
        {
          status: 401,
        }
      );
    }

    const { data: isAdmin } =
      await clientSupabase.rpc("is_current_user_admin");

    if (!isAdmin) {
      return NextResponse.json(
        {
          error: "Droits administrateur requis.",
        },
        {
          status: 403,
        }
      );
    }

    const body = (await request.json()) as ImportBody;

    const adminSupabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const joueurs = body.rawData.joueurs ?? [];
    const parties = body.rawData.parties ?? [];
    const resultats = body.rawData.resultats ?? [];

    /*
     * TRUNCATE LOGIQUE
     */

    await adminSupabase
      .from("skyjo_game_results")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    await adminSupabase
      .from("skyjo_games")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    await adminSupabase
      .from("skyjo_players")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    /*
     * JOUEURS
     */

    const playersPayload = joueurs
      .map((row) => ({
        joueur_id: asText(
          getValue(row, [
            "JoueurID",
            "joueur_id",
            "joueurId",
          ])
        ),

        display_name: asText(
          getValue(row, [
            "Nom",
            "nom",
            "display_name",
          ])
        ),

        team_service:
          asText(
            getValue(row, [
              "Equipe / Service",
              "Equipe",
              "Service",
            ])
          ) || null,

        arrived_at: normalizeDate(
          getValue(row, [
            "DateArrivee",
            "DateArrivée",
          ])
        ),

        email:
          asText(
            getValue(row, [
              "Email",
              "email",
              "Mail",
            ])
          ) || null,

        is_active: true,
      }))
      .filter(
        (row) =>
          row.joueur_id &&
          row.display_name
      );

    const {
      data: insertedPlayers,
      error: playersError,
    } = await adminSupabase
      .from("skyjo_players")
      .insert(playersPayload)
      .select("id, joueur_id");

    if (playersError) {
      throw playersError;
    }

    /*
     * PARTIES
     */

    const gamesPayload = parties
      .map((row) => ({
        partie_id: asText(
          getValue(row, [
            "PartieID",
            "partie_id",
            "partieId",
          ])
        ),

        played_at: normalizeDate(
          getValue(row, [
            "DatePartie",
            "datePartie",
            "Date",
          ])
        ),

        location:
          asText(
            getValue(row, [
              "Lieu",
              "location",
            ])
          ) || null,

        expected_players_count: asNumber(
          getValue(row, [
            "NbJoueurs",
            "NombreJoueurs",
          ])
        ),
      }))
      .filter(
        (row) =>
          row.partie_id &&
          row.played_at
      );

    const {
      data: insertedGames,
      error: gamesError,
    } = await adminSupabase
      .from("skyjo_games")
      .insert(gamesPayload)
      .select("id, partie_id");

    if (gamesError) {
      throw gamesError;
    }

    const playerMap = new Map(
      (insertedPlayers ?? []).map((player) => [
        player.joueur_id,
        player.id,
      ])
    );

    const gameMap = new Map(
      (insertedGames ?? []).map((game) => [
        game.partie_id,
        game.id,
      ])
    );

    /*
     * RESULTATS
     */

    const usedResultatIds = new Set<string>();

    const resultsPayload = resultats
      .map((row, index) => {
        const resultatIdRaw = asText(
          getValue(row, [
            "ResultatID",
            "resultat_id",
          ])
        );

        const partieId = asText(
          getValue(row, [
            "PartieID",
            "partie_id",
          ])
        );

        const joueurId = asText(
          getValue(row, [
            "JoueurID",
            "joueur_id",
          ])
        );

        const gameId = gameMap.get(partieId);
        const playerId = playerMap.get(joueurId);

        if (!gameId || !playerId) {
          return null;
        }

        let resultatId = resultatIdRaw;

        if (!resultatId || usedResultatIds.has(resultatId)) {
          resultatId = `R${String(index + 1).padStart(6, "0")}`;
        }

        usedResultatIds.add(resultatId);

        return {
          resultat_id: resultatId,

          game_id: gameId,

          player_id: playerId,

          score:
            asNumber(
              getValue(row, [
                "Score",
                "score",
              ])
            ) ?? 0,

          position: asNumber(
            getValue(row, [
              "Position",
              "position",
              "Classement",
            ])
          ),

          source_created_at: null,

          source_created_by: null,

          hash_resultat:
            asText(
              getValue(row, [
                "HashResultat",
              ])
            ) || null,

          hash_last_audit:
            asText(
              getValue(row, [
                "HashDernierAudit",
              ])
            ) || null,
        };
      })
      .filter(Boolean);

    const { error: resultsError } =
      await adminSupabase
        .from("skyjo_game_results")
        .insert(resultsPayload);

    if (resultsError) {
      throw resultsError;
    }

    /*
     * DATASET JSON LEGACY
     */

    await adminSupabase
      .from("skyjo_dataset")
      .upsert({
        id: "active",
        data: body.appData,
        updated_at: body.updatedAt,
        file_name: body.fileName,
        updated_by_email:
          body.updatedByEmail ??
          user.email,
      });

    return NextResponse.json({
      ok: true,

      summary: {
        players: playersPayload.length,
        games: gamesPayload.length,
        results: resultsPayload.length,
      },
    });
  } catch (error) {
    console.error("IMPORT SKYJO ERROR =", error);

    return NextResponse.json(
    {
        error: JSON.stringify(error, null, 2),
    },
    {
        status: 500,
    }
    );
  }
}