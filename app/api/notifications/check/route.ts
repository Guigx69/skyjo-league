import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const SILENCE_DELAY_MINUTES = 30;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from("skyjo_notification_batches")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (batchError) {
      throw batchError;
    }

    if (!batch) {
      return NextResponse.json({
        success: true,
        message: "Aucun batch ouvert.",
      });
    }

    const lastGameDate = new Date(batch.last_game_added_at);
    const diffMinutes = (Date.now() - lastGameDate.getTime()) / 1000 / 60;

    if (diffMinutes < SILENCE_DELAY_MINUTES) {
      return NextResponse.json({
        success: true,
        message: "Batch encore actif.",
        diffMinutes: Math.round(diffMinutes),
        remainingMinutes: Math.ceil(SILENCE_DELAY_MINUTES - diffMinutes),
      });
    }

    const { data: games, error: gamesError } = await supabase
      .from("skyjo_games")
      .select(
        "id, partie_id, played_at, location, expected_players_count, created_at"
      )
      .gte("created_at", batch.first_game_added_at)
      .lte("created_at", batch.last_game_added_at)
      .order("created_at", { ascending: true });

    if (gamesError) {
      throw gamesError;
    }

    const { data: recipients, error: recipientsError } = await supabase
      .from("profiles")
      .select("email")
      .eq("notify_new_games", true)
      .not("email", "is", null);

    if (recipientsError) {
      throw recipientsError;
    }

    const validRecipients = Array.from(
      new Set(
        (recipients ?? [])
          .map((recipient) => recipient.email)
          .filter((email): email is string => Boolean(email))
      )
    );

    const gamesCount = games?.length ?? 0;
    const recipientsCount = validRecipients.length;

    if (gamesCount === 0) {
      await markBatchAsSent(batch.id);

      return NextResponse.json({
        success: true,
        message: "Batch traité sans partie.",
        gamesCount,
        recipientsCount,
      });
    }

    if (recipientsCount === 0) {
      await markBatchAsSent(batch.id);

      return NextResponse.json({
        success: true,
        message: "Batch traité sans destinataire.",
        gamesCount,
        recipientsCount,
      });
    }

    const subject =
      gamesCount === 1
        ? "Nouvelle partie Skyjo ajoutée"
        : `${gamesCount} nouvelles parties Skyjo ajoutées`;

    const html = buildNotificationEmailHtml(games ?? []);

    await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ??
        "Skyjo Seenovate <onboarding@resend.dev>",
      to:
        process.env.RESEND_NOTIFICATION_TO ??
        "delivered@resend.dev",
      bcc: validRecipients,
      subject,
      html,
    });

    await markBatchAsSent(batch.id);

    return NextResponse.json({
      success: true,
      message: "Batch envoyé et traité.",
      batchId: batch.id,
      gamesCount,
      recipientsCount,
    });
  } catch (error) {
    console.warn("Erreur cron notifications Skyjo :", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erreur pendant le traitement du cron.",
      },
      { status: 500 }
    );
  }
}

async function markBatchAsSent(batchId: string) {
  const { error } = await supabase
    .from("skyjo_notification_batches")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  if (error) {
    throw error;
  }
}

function buildNotificationEmailHtml(
  games: {
    id: string;
    partie_id: number | string | null;
    played_at: string | null;
    location: string | null;
    expected_players_count: number | null;
    created_at: string;
  }[]
) {
  const title =
    games.length === 1
      ? "Une nouvelle partie Skyjo a été ajoutée"
      : `${games.length} nouvelles parties Skyjo ont été ajoutées`;

  const gamesHtml = games
    .map((game) => {
      const playedAt = game.played_at
        ? new Date(game.played_at).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "Date non renseignée";

      return `
        <div style="background:#111827;border:1px solid #1f2937;border-radius:18px;padding:18px;margin-bottom:14px;">
          <div style="font-size:16px;font-weight:700;color:#f9fafb;margin-bottom:8px;">
            Partie ${game.partie_id ? `#${game.partie_id}` : "Skyjo"}
          </div>

          <div style="font-size:14px;color:#cbd5e1;line-height:1.7;">
            <div><strong>Date :</strong> ${playedAt}</div>
            <div><strong>Lieu :</strong> ${game.location ?? "Non renseigné"}</div>
            <div><strong>Joueurs prévus :</strong> ${
              game.expected_players_count ?? "Non renseigné"
            }</div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>

      <body style="margin:0;padding:0;background:#020617;font-family:Arial,Helvetica,sans-serif;">
        <div style="padding:32px 16px;background:linear-gradient(135deg,#020617,#0f172a);">
          <div style="max-width:680px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:28px;overflow:hidden;">
            
            <div style="padding:32px 32px 20px 32px;">
              <div style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#38bdf8;font-weight:700;margin-bottom:14px;">
                Skyjo Seenovate
              </div>

              <h1 style="margin:0;color:#f8fafc;font-size:28px;line-height:1.2;">
                ${title}
              </h1>

              <p style="margin:16px 0 0 0;color:#cbd5e1;font-size:15px;line-height:1.7;">
                Le classement peut maintenant être mis à jour avec les dernières parties ajoutées.
              </p>
            </div>

            <div style="padding:12px 32px 28px 32px;">
              ${gamesHtml}
            </div>

            <div style="padding:22px 32px;background:#020617;border-top:1px solid #1e293b;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                Tu reçois cet email car les notifications Skyjo sont activées sur ton compte.
              </p>
            </div>

          </div>
        </div>
      </body>
    </html>
  `;
}