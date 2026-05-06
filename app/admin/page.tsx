"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import {
  mapExcelToSkyjoData,
  type MappedSkyjoData,
} from "@/lib/excelMappers";

const adminCards = [
  {
    title: "Importer les parties",
    description: "Import Excel local depuis le fichier SharePoint.",
    status: "Actif",
  },
  {
    title: "Gérer les joueurs",
    description: "Activation, rattachement email, rôles et profils joueurs.",
    status: "Mock",
  },
  {
    title: "Paramètres saison",
    description: "Définition de la saison active et règles de classement.",
    status: "Mock",
  },
  {
    title: "Contrôle qualité",
    description: "Détection des parties incomplètes ou incohérentes.",
    status: "À venir",
  },
];

type ExcelRawData = {
  joueurs: Record<string, unknown>[];
  parties: Record<string, unknown>[];
  resultats: Record<string, unknown>[];
};

type ImportMetadata = {
  fileName: string | null;
  updatedAt: string | null;
  updatedByEmail: string | null;
};

export default function AdminPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });

  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();

  const [rawExcelData, setRawExcelData] = useState<ExcelRawData | null>(null);
  const [mappedData, setMappedData] = useState<MappedSkyjoData | null>(null);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importing, setImporting] = useState(false);

  const [importMetadata, setImportMetadata] = useState<ImportMetadata>({
    fileName: null,
    updatedAt: null,
    updatedByEmail: null,
  });

  useEffect(() => {
    const checkAdminRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        window.location.href = "/login";
        return;
      }

      setUserEmail(user.email);

      const { data, error } = await supabase.rpc("is_current_user_admin");

      if (error || !data) {
        setIsAdmin(false);
        setCheckingRole(false);

        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 2200);

        return;
      }

      setIsAdmin(true);
      setCheckingRole(false);
      await fetchImportMetadata();
    };

    if (!checkingAuth) {
      checkAdminRole();
    }
  }, [checkingAuth]);

  const fetchImportMetadata = async () => {
    const { data, error } = await supabase
      .from("skyjo_dataset")
      .select("data, updated_at, file_name, updated_by_email")
      .eq("id", "active")
      .maybeSingle();

    if (error) {
      console.error("Erreur lecture metadata import :", error);
      return;
    }

    if (!data) {
      return;
    }

    setImportMetadata({
      fileName: data.file_name ?? null,
      updatedAt: data.updated_at ?? null,
      updatedByEmail: data.updated_by_email ?? null,
    });

    if (data.data) {
      setMappedData(data.data as MappedSkyjoData);
    }
  };

  const handleExcelUpload = async (file: File) => {
    setImportError("");
    setImportSuccess("");
    setRawExcelData(null);
    setMappedData(null);
    setImporting(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);

      const parseSheet = (sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];

        if (!sheet) {
          throw new Error(`La table ou feuille ${sheetName} est introuvable.`);
        }

        return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      };

      const rawData: ExcelRawData = {
        joueurs: parseSheet("T_JOUEURS"),
        parties: parseSheet("T_PARTIES"),
        resultats: parseSheet("T_RESULTATS"),
      };

      const appData = mapExcelToSkyjoData(rawData);
      const updatedAt = new Date().toISOString();

      const { error } = await supabase.from("skyjo_dataset").upsert({
        id: "active",
        data: appData,
        updated_at: updatedAt,
        file_name: file.name,
        updated_by_email: userEmail ?? null,
      });

      if (error) {
        console.error("Erreur sauvegarde Supabase :", error);
        setImportError(
          "Import lu correctement, mais sauvegarde Supabase impossible. Vérifie les droits admin/RLS et les colonnes file_name / updated_by_email."
        );
        return;
      }

      setRawExcelData(rawData);
      setMappedData(appData);

      setImportMetadata({
        fileName: file.name,
        updatedAt,
        updatedByEmail: userEmail ?? null,
      });

      setImportSuccess("Fichier chargé et sauvegardé avec succès.");
    } catch (error) {
      console.error(error);
      setImportError(
        "Import impossible. Vérifie que le fichier contient bien T_JOUEURS, T_PARTIES et T_RESULTATS."
      );
    } finally {
      setImporting(false);
    }
  };

  if (checkingAuth || checkingRole) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/80">
            Admin
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-white">
            Vérification des droits
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Nous vérifions que ton compte dispose des autorisations
            administrateur.
          </p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-red-400/20 bg-red-400/[0.08] p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300/80">
            Accès refusé
          </p>

          <h1 className="mt-4 text-2xl font-semibold text-white">
            Droits administrateur requis
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-100/80">
            Ton compte n’a pas les droits nécessaires pour accéder à cet espace.
            Tu vas être redirigé vers le dashboard.
          </p>

          <button
            type="button"
            onClick={() => (window.location.href = "/dashboard")}
            className="mt-6 w-full rounded-2xl border border-red-300/20 bg-white/[0.06] px-4 py-3 text-sm font-medium text-red-100 transition hover:bg-white hover:text-slate-950"
          >
            Retourner au dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-amber-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/80">
              Admin
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Pilotage de la ligue
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300">
              Espace de gestion des imports, des joueurs, des saisons et des
              contrôles qualité.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <AdminKpi
            label="Source data"
            value="SharePoint Excel"
            tone="blue"
          />

          <AdminKpi
            label="Mode actuel"
            value={mappedData ? "Excel chargé" : "Aucune donnée"}
            tone={mappedData ? "emerald" : "amber"}
          />

          <AdminKpi
            label="Joueurs app"
            value={mappedData ? mappedData.players.length : "—"}
            tone="violet"
          />

          <AdminKpi
            label="Statut import"
            value={mappedData ? "Mapping OK" : "À importer"}
            tone={mappedData ? "emerald" : "amber"}
          />
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                État du dataset
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-white">
                Dernier fichier chargé
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Cette section permet de vérifier rapidement si un fichier a déjà
                été chargé, quand, et par quel compte.
              </p>
            </div>

            <span
              className={`rounded-full border px-4 py-2 text-xs font-medium ${
                importMetadata.updatedAt
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-200"
              }`}
            >
              {importMetadata.updatedAt ? "Dataset actif" : "Aucun import"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MetadataCard
              label="Fichier"
              value={importMetadata.fileName ?? "Aucun fichier chargé"}
            />

            <MetadataCard
              label="Chargé le"
              value={
                importMetadata.updatedAt
                  ? formatDateTime(importMetadata.updatedAt)
                  : "—"
              }
            />

            <MetadataCard
              label="Chargé par"
              value={importMetadata.updatedByEmail ?? "—"}
            />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Import Excel
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            Charger les données Skyjo
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Importe le fichier Excel exporté depuis SharePoint. Chaque nouvel
            import remplace les données précédemment sauvegardées dans Supabase.
          </p>

          <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center transition hover:bg-white/[0.04]">
            <span className="text-sm font-medium text-white">
              {importing ? "Import en cours..." : "Sélectionner un fichier .xlsx"}
            </span>
            <span className="mt-2 text-xs text-zinc-500">
              Tables attendues : T_JOUEURS, T_PARTIES, T_RESULTATS
            </span>

            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  handleExcelUpload(file);
                }

                event.target.value = "";
              }}
            />
          </label>

          {importError && (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {importError}
            </div>
          )}

          {importSuccess && (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {importSuccess}
            </div>
          )}

          {rawExcelData && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-xs text-emerald-200/80">
                  Lignes T_JOUEURS
                </p>
                <p className="mt-2 text-3xl font-semibold text-emerald-100">
                  {rawExcelData.joueurs.length}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                <p className="text-xs text-blue-200/80">Lignes T_PARTIES</p>
                <p className="mt-2 text-3xl font-semibold text-blue-100">
                  {rawExcelData.parties.length}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-xs text-amber-200/80">
                  Lignes T_RESULTATS
                </p>
                <p className="mt-2 text-3xl font-semibold text-amber-100">
                  {rawExcelData.resultats.length}
                </p>
              </div>
            </div>
          )}

          {mappedData && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">
                Données transformées prêtes pour l’application
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-zinc-500">Players</p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {mappedData.players.length}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-zinc-500">Games</p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {mappedData.games.length}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-zinc-500">Rivalries</p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {mappedData.rivalries.length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {adminCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    {card.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {card.description}
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
                  {card.status}
                </span>
              </div>

              <button
                type="button"
                className="mt-6 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
              >
                Configurer
              </button>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function AdminKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "emerald" | "amber" | "violet";
}) {
  const toneClass = {
    blue: "text-blue-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
  };

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-6">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${toneClass[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function MetadataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}