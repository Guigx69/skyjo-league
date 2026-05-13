"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

const MONTH_LABELS = [
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

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export default function NewGamePage() {
  const router = useRouter();

  const { checkingAuth } = useAuthRedirect({
    requireAuth: true,
  });

  const [loading, setLoading] = useState(false);

  const [partieId, setPartieId] = useState("");
  const [playedAt, setPlayedAt] = useState("");
  const [location, setLocation] = useState("");
  const [expectedPlayersCount, setExpectedPlayersCount] = useState("");

  const [playedAtError, setPlayedAtError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [playersCountError, setPlayersCountError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    generateNextPartieId();
    setPlayedAt(getTodaySqlDate());
  }, []);

  const generateNextPartieId = async () => {
    const { data, error } = await supabase
      .from("skyjo_games")
      .select("partie_id")
      .order("partie_id", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Erreur génération partie_id :", error);
      setErrorMessage("Impossible de générer le prochain ID partie.");
      return;
    }

    const lastId = data?.[0]?.partie_id;

    if (!lastId) {
      setPartieId("P0001");
      return;
    }

    const numericPart = Number(String(lastId).replace("P", ""));

    if (!Number.isFinite(numericPart)) {
      setPartieId("P0001");
      return;
    }

    setPartieId(`P${String(numericPart + 1).padStart(4, "0")}`);
  };

  const handleSubmit = async () => {
    setSuccessMessage("");
    setErrorMessage("");
    setPlayedAtError("");
    setLocationError("");
    setPlayersCountError("");

    const trimmedLocation = location.trim();
    const playersCount = Number(expectedPlayersCount);

    let hasError = false;

    if (!playedAt) {
      setPlayedAtError("La date de la partie est obligatoire.");
      hasError = true;
    }

    if (!trimmedLocation) {
      setLocationError("Le lieu de la partie est obligatoire.");
      hasError = true;
    }

    if (!expectedPlayersCount) {
      setPlayersCountError("Le nombre de joueurs prévu est obligatoire.");
      hasError = true;
    } else if (
      !Number.isInteger(playersCount) ||
      playersCount < 2 ||
      playersCount > 12
    ) {
      setPlayersCountError("Le nombre de joueurs doit être compris entre 2 et 12.");
      hasError = true;
    }

    if (!partieId) {
      setErrorMessage("L’ID de partie n’est pas encore généré.");
      hasError = true;
    }

    if (hasError) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("skyjo_games")
        .insert({
          partie_id: partieId,
          played_at: playedAt,
          location: trimmedLocation,
          expected_players_count: playersCount,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Erreur création partie :", error);

        if (error.code === "23505") {
          setErrorMessage("Cette partie existe déjà.");
          return;
        }

        setErrorMessage("Impossible de créer la partie. Vérifie les droits Supabase.");
        return;
      }

      if (!data?.id) {
        setErrorMessage("Partie créée, mais impossible de récupérer son ID.");
        return;
      }

      setSuccessMessage("La partie a été créée avec succès.");

      router.push(`/games/${data.id}/results`);
    } catch (error) {
      console.error(error);
      setErrorMessage("Erreur pendant la création de la partie.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        Chargement...
      </main>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-blue-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
            Nouvelle partie
          </p>

          <h1 className="mt-4 text-4xl font-semibold text-white">
            Créer une partie
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Création manuelle d’une partie Skyjo avant ajout des résultats.
          </p>
        </section>

        <section className="max-w-2xl rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Formulaire
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-white">
                Informations partie
              </h2>
            </div>

            <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-medium text-zinc-400">
              <span className="text-red-300">*</span> Champ obligatoire
            </div>
          </div>

          <div className="mt-8 space-y-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                ID Partie
              </label>

              <input
                value={partieId}
                disabled
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-semibold text-zinc-400 outline-none"
              />

              <p className="mt-2 text-xs text-zinc-500">
                Généré automatiquement à partir de la dernière partie créée.
              </p>
            </div>

            <DatePickerPremium
              label="Date"
              value={playedAt}
              error={playedAtError}
              onChange={(value) => {
                setPlayedAt(value);
                setPlayedAtError("");
              }}
            />

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Lieu
                <span className="text-red-300">*</span>
              </label>

              <input
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  if (locationError) setLocationError("");
                }}
                placeholder="Ex : Lyon / Bureau / Terrasse..."
                maxLength={60}
                className={`mt-2 h-12 w-full rounded-2xl border bg-black/25 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 ${
                  locationError
                    ? "border-red-400/40 focus:border-red-400/70"
                    : "border-white/10 focus:border-blue-400/50"
                }`}
              />

              <div className="mt-2 flex items-center justify-between gap-4">
                <p
                  className={`text-xs ${
                    locationError ? "text-red-300" : "text-zinc-500"
                  }`}
                >
                  {locationError ||
                    "Lieu utilisé dans l’historique et les statistiques."}
                </p>

                <p className="shrink-0 text-xs text-zinc-600">
                  {location.length}/60
                </p>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Nombre de joueurs prévu
                <span className="text-red-300">*</span>
              </label>

              <input
                type="number"
                min={2}
                max={12}
                value={expectedPlayersCount}
                onChange={(event) => {
                  setExpectedPlayersCount(event.target.value);
                  if (playersCountError) setPlayersCountError("");
                }}
                placeholder="Ex : 4"
                className={`mt-2 h-12 w-full rounded-2xl border bg-black/25 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 ${
                  playersCountError
                    ? "border-red-400/40 focus:border-red-400/70"
                    : "border-white/10 focus:border-blue-400/50"
                }`}
              />

              <p
                className={`mt-2 text-xs ${
                  playersCountError ? "text-red-300" : "text-zinc-500"
                }`}
              >
                {playersCountError ||
                  "Nombre attendu pour contrôler ensuite les résultats saisis."}
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {successMessage}
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Création..." : "Créer la partie"}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function DatePickerPremium({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseSqlDate(value) : new Date();
  const [viewDate, setViewDate] = useState(selectedDate);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useCloseOnOutsideClick(containerRef, () => setOpen(false));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getCalendarDays(year, month);

  return (
    <div ref={containerRef} className="relative">
      <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
        <span className="text-red-300">*</span>
      </label>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`mt-2 flex h-12 w-full items-center justify-between rounded-2xl border bg-black/25 px-4 text-left text-sm font-semibold text-white outline-none transition ${
          error
            ? "border-red-400/40 focus:border-red-400/70"
            : "border-white/10 hover:border-blue-400/40 focus:border-blue-400/50"
        }`}
      >
        <span>{value ? formatDisplayDate(value) : "Sélectionner une date"}</span>
        <span className="text-zinc-500">📅</span>
      </button>

      <p className={`mt-2 text-xs ${error ? "text-red-300" : "text-zinc-500"}`}>
        {error || "Date utilisée pour classer la partie dans la bonne saison."}
      </p>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.65rem)] z-50 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#060B16] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              ←
            </button>

            <p className="text-sm font-semibold text-white">
              {MONTH_LABELS[month]} {year}
            </p>

            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              →
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
            {DAY_LABELS.map((day, index) => (
              <div
                key={`${day}-${index}`}
                className="py-2 text-center text-[10px] font-semibold uppercase text-zinc-600"
              >
                {day}
              </div>
            ))}

            {days.map((day) => {
              const sqlDate = toSqlDate(day.date);
              const isSelected = sqlDate === value;
              const isCurrentMonth = day.currentMonth;
              const isToday = sqlDate === getTodaySqlDate();

              return (
                <button
                  key={sqlDate}
                  type="button"
                  onClick={() => {
                    onChange(sqlDate);
                    setOpen(false);
                  }}
                  className={`h-10 rounded-xl text-sm font-semibold transition ${
                    isSelected
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                      : isToday
                        ? "border border-blue-400/30 bg-blue-400/10 text-blue-200 hover:bg-blue-400/20"
                        : isCurrentMonth
                          ? "text-zinc-200 hover:bg-white/[0.06]"
                          : "text-zinc-700 hover:bg-white/[0.03]"
                  }`}
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const today = getTodaySqlDate();
              onChange(today);
              setViewDate(new Date());
              setOpen(false);
            }}
            className="mt-4 w-full rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white hover:text-slate-950"
          >
            Aujourd’hui
          </button>
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

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date,
      currentMonth: date.getMonth() === month,
    };
  });
}

function parseSqlDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toSqlDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodaySqlDate() {
  return toSqlDate(new Date());
}

function formatDisplayDate(value: string) {
  const date = parseSqlDate(value);

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}