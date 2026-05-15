import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateGameBody = {
  partieId: string;
  playedAt: string;
  location: string | null;
  expectedPlayersCount: number | null;
  results: {
    joueurId: string;
    score: number;
    position: number | null;
  }[];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return NextResponse.json(
        { error: "Variables Supabase manquantes." },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Session invalide." },
        { status: 401 }
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
        { error: "Utilisateur non authentifié." },
        { status: 401 }
      );
    }

    const { data: isAdmin } = await clientSupabase.rpc("is_current_user_admin");

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Droits administrateur requis." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateGameBody;

    if (!body.partieId?.trim()) {
      return NextResponse.json(
        { error: "PartieID obligatoire." },
        { status: 400 }
      );
    }

    if (!body.playedAt) {
      return NextResponse.json(
        { error: "Date de partie obligatoire." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.results) || body.results.length === 0) {
      return NextResponse.json(
        { error: "Résultats joueurs obligatoires." },
        { status: 400 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const partieId = body.partieId.trim();

    const { data: existingGame, error: existingGameError } = await adminSupabase
      .from("skyjo_games")
      .select("id")
      .eq("partie_id", partieId)
      .maybeSingle();

    if (existingGameError) {
      throw existingGameError;
    }

    if (existingGame) {
      return NextResponse.json(
        { error: `La partie ${partieId} existe déjà.` },
        { status: 409 }
      );
    }

    const { data: insertedGame, error: gameError } = await adminSupabase
      .from("skyjo_games")
      .insert({
        partie_id: partieId,
        played_at: body.playedAt,
        location: body.location?.trim() || null,
        expected_players_count: body.expectedPlayersCount,
      })
      .select("id, partie_id")
      .single();

    if (gameError) {
      throw gameError;
    }

    const joueurIds = body.results
      .map((result) => result.joueurId.trim())
      .filter(Boolean);

    const { data: players, error: playersError } = await adminSupabase
      .from("skyjo_players")
      .select("id, joueur_id")
      .in("joueur_id", joueurIds);

    if (playersError) {
      throw playersError;
    }

    const playerMap = new Map(
      (players ?? []).map((player) => [player.joueur_id, player.id])
    );

    const missingPlayers = joueurIds.filter((joueurId) => !playerMap.has(joueurId));

    if (missingPlayers.length > 0) {
      await adminSupabase
        .from("skyjo_games")
        .delete()
        .eq("id", insertedGame.id);

      return NextResponse.json(
        {
          error: "Certains joueurs sont introuvables.",
          missingPlayers,
        },
        { status: 400 }
      );
    }

    const resultsPayload = body.results.map((result, index) => ({
      resultat_id: `${partieId}_R${String(index + 1).padStart(3, "0")}`,
      game_id: insertedGame.id,
      player_id: playerMap.get(result.joueurId.trim()),
      score: result.score,
      position: result.position,
      source_created_at: new Date().toISOString(),
      source_created_by: user.email,
      hash_resultat: null,
      hash_last_audit: null,
    }));

    const { error: resultsError } = await adminSupabase
      .from("skyjo_game_results")
      .insert(resultsPayload);

    if (resultsError) {
      await adminSupabase
        .from("skyjo_games")
        .delete()
        .eq("id", insertedGame.id);

      throw resultsError;
    }

    await upsertNotificationBatch(adminSupabase);

    return NextResponse.json({
      ok: true,
      message: "Partie créée avec succès.",
      game: insertedGame,
      summary: {
        partieId,
        results: resultsPayload.length,
        notificationBatch: "created_or_updated",
      },
    });
  } catch (error) {
    console.error("CREATE SKYJO GAME ERROR =", error);

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

async function upsertNotificationBatch(supabase: any) {
  const now = new Date().toISOString();

  const { data: existingBatch, error: existingBatchError } = await supabase
    .from("skyjo_notification_batches")
    .select("id")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingBatchError) {
    throw existingBatchError;
  }

  if (existingBatch) {
    const { error } = await supabase
      .from("skyjo_notification_batches")
      .update({
        last_game_added_at: now,
      })
      .eq("id", existingBatch.id);

    if (error) throw error;

    return;
  }

  const { error } = await supabase
    .from("skyjo_notification_batches")
    .insert({
      status: "open",
      first_game_added_at: now,
      last_game_added_at: now,
    });

  if (error) throw error;
}