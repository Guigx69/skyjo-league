import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const SILENCE_DELAY_MINUTES = 30;

type SkyjoGame = {
  id: string;
  partie_id: string | number | null;
  played_at: string | null;
  location: string | null;
  expected_players_count: number | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
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

    if (batchError) throw batchError;

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

    if (gamesError) throw gamesError;

    const gamesToNotify = (games ?? []) as SkyjoGame[];

    if (gamesToNotify.length === 0) {
      await markBatchAsSent(batch.id);

      return NextResponse.json({
        success: true,
        message: "Batch vide, marqué comme envoyé.",
      });
    }

    const { data: recipients, error: recipientsError } = await supabase
      .from("profiles")
      .select("email")
      .eq("notify_new_games", true)
      .not("email", "is", null);

    if (recipientsError) throw recipientsError;

    const validRecipients = Array.from(
      new Set(
        (recipients ?? [])
          .map((recipient) => String(recipient.email ?? "").trim())
          .filter((email) => isValidEmail(email))
      )
    );

    if (validRecipients.length === 0) {
      await markBatchAsSent(batch.id);

      return NextResponse.json({
        success: true,
        message: "Aucun destinataire, batch marqué comme envoyé.",
        gamesCount: gamesToNotify.length,
      });
    }

    const from = process.env.EMAIL_FROM;
    const to = process.env.EMAIL_TO;
    const appUrl = process.env.APP_URL;

    if (!from || !to || !appUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "EMAIL_FROM, EMAIL_TO ou APP_URL manquant.",
        },
        { status: 500 }
      );
    }

    const subject =
      gamesToNotify.length === 1
        ? "Une nouvelle partie Skyjo a été ajoutée"
        : `${gamesToNotify.length} nouvelles parties Skyjo ont été ajoutées`;

    const html = buildEmailHtml({
      games: gamesToNotify,
      appUrl,
    });

    const text = buildEmailText({
      games: gamesToNotify,
      appUrl,
    });

    const { data: emailData, error: emailError } = await resend.emails.send({
      from,
      to,
      bcc: validRecipients,
      subject,
      html,
      text,
    });

    if (emailError) {
      console.warn("Erreur envoi Resend :", emailError);

      return NextResponse.json(
        {
          success: false,
          message: "Email non envoyé. Batch conservé ouvert.",
          recipientsCount: validRecipients.length,
        },
        { status: 500 }
      );
    }

    console.log("Notification Skyjo envoyée :", {
      resendEmailId: emailData?.id,
      batchId: batch.id,
      gamesCount: gamesToNotify.length,
      recipientsCount: validRecipients.length,
    });

    await markBatchAsSent(batch.id);

    return NextResponse.json({
      success: true,
      message: "Notifications envoyées.",
      batchId: batch.id,
      resendEmailId: emailData?.id,
      gamesCount: gamesToNotify.length,
      recipientsCount: validRecipients.length,
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

  if (error) throw error;
}

function buildEmailHtml({
  games,
  appUrl,
}: {
  games: SkyjoGame[];
  appUrl: string;
}) {
  const title =
    games.length === 1
      ? "Nouvelle partie ajoutée"
      : `${games.length} nouvelles parties ajoutées`;

  const rows = games
    .map((game) => {
      const date = formatDateFr(game.played_at);
      const location = escapeHtml(game.location ?? "Lieu non renseigné");
      const players = game.expected_players_count ?? "—";
      const partieId = escapeHtml(String(game.partie_id ?? "Partie Skyjo"));

      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #1f2937;">
            <div style="font-weight:700;color:#ffffff;">${partieId}</div>
            <div style="margin-top:4px;color:#94a3b8;font-size:13px;">
              ${date} · ${location} · ${players} joueurs
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#020617;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;">
    <div style="max-width:640px;margin:0 auto;border:1px solid #1f2937;border-radius:28px;overflow:hidden;background:#0f172a;">
      <div style="padding:32px;background:linear-gradient(135deg,#111827,#083344);">
        <div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:#67e8f9;font-weight:700;">
          Skyjo Seenovate
        </div>

        <h1 style="margin:18px 0 0;font-size:32px;line-height:1.1;color:#ffffff;">
          ${title}
        </h1>

        <p style="margin:14px 0 0;color:#cbd5e1;font-size:15px;line-height:1.6;">
          Les résultats peuvent maintenant être consultés depuis l’espace Skyjo.
        </p>
      </div>

      <div style="padding:28px 32px;">
        <table style="width:100%;border-collapse:collapse;">
          ${rows}
        </table>

        <a href="${escapeHtml(appUrl)}/games"
           style="display:block;margin-top:28px;text-align:center;background:#67e8f9;color:#020617;text-decoration:none;font-weight:800;padding:15px 20px;border-radius:18px;">
          Voir les parties
        </a>

        <p style="margin:22px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
          Tu reçois cet email car les notifications de nouvelles parties sont activées dans tes paramètres.
        </p>
      </div>
    </div>
  </body>
</html>
  `;
}

function buildEmailText({
  games,
  appUrl,
}: {
  games: SkyjoGame[];
  appUrl: string;
}) {
  const title =
    games.length === 1
      ? "Une nouvelle partie Skyjo a été ajoutée."
      : `${games.length} nouvelles parties Skyjo ont été ajoutées.`;

  const lines = games.map((game) => {
    return `- ${game.partie_id ?? "Partie Skyjo"} · ${formatDateFr(
      game.played_at
    )} · ${game.location ?? "Lieu non renseigné"} · ${
      game.expected_players_count ?? "—"
    } joueurs`;
  });

  return `${title}

${lines.join("\n")}

Voir les parties :
${appUrl}/games`;
}

function formatDateFr(value: string | null | undefined) {
  if (!value) return "Date inconnue";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}