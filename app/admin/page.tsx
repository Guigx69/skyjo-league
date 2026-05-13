"use client";

import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import {
  mapExcelToSkyjoData,
  type MappedSkyjoData,
} from "@/lib/excelMappers";

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

type PendingImport = {
  fileName: string;
  updatedAt: string;
  rawData: ExcelRawData;
  appData: MappedSkyjoData;
};

type QualityIssueType =
  | "missing-date"
  | "missing-results"
  | "duplicate-players"
  | "missing-score"
  | "missing-position"
  | "several-winners";

type QualityIssueDetail = {
  gameId: string;
  gameDate: string;
  location: string;
  playersCount: string;
  description: string;
  rows: {
    player: string;
    score: string;
    position: string;
    status: string;
  }[];
};

type QualityIssue = {
  id: QualityIssueType;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  count: number;
  details: QualityIssueDetail[];
};

type AdminLog = {
  id?: string | number;
  created_at?: string;
  date: string;
  title: string;
  description: string;
  tone: "emerald" | "blue" | "amber" | "red";
  created_by_email?: string | null;
};

type PlayerAuditRow = {
  id: string;
  name: string;
  normalizedName: string;
  email: string;
  status: "Actif" | "Inactif" | "Non lié";
  role: "Joueur" | "Admin";
  games: number;
  wins: number;
  duplicateGroupSize: number;
  lastActivity: string;
};

type PlayerOverride = {
  joueur_id: string;
  display_name: string | null;
  email: string | null;
  status: "Actif" | "Inactif" | "Non lié" | string | null;
  role: "Joueur" | "Admin" | string | null;
  updated_at?: string | null;
  updated_by_email?: string | null;
};

type ProfileRow = {
  user_id: string;
  email: string;
  role: string;
};

type PlayerOverrideForm = {
  displayName: string;
  email: string;
  status: "Actif" | "Inactif" | "Non lié";
  role: "Joueur" | "Admin";
};

type PlayerFilter = "all" | "duplicates" | "unlinked" | "inactive";

const expectedSheets = ["T_JOUEURS", "T_PARTIES", "T_RESULTATS"];

const playerFilterOptions: { value: PlayerFilter; label: string }[] = [
  {
    value: "all",
    label: "Tous les joueurs",
  },
  {
    value: "duplicates",
    label: "Doublons potentiels",
  },
  {
    value: "unlinked",
    label: "Sans email lié",
  },
  {
    value: "inactive",
    label: "Inactifs",
  },
];

export default function AdminPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });

  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();

  const [rawExcelData, setRawExcelData] = useState<ExcelRawData | null>(null);
  const [mappedData, setMappedData] = useState<MappedSkyjoData | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedIssueId, setSelectedIssueId] =
    useState<QualityIssueType | null>(null);

  const [persistedLogs, setPersistedLogs] = useState<AdminLog[]>([]);
  const [logStorageStatus, setLogStorageStatus] = useState<
    "ready" | "missing" | "unchecked"
  >("unchecked");

  const [refreshingDataset, setRefreshingDataset] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshTone, setRefreshTone] = useState<"blue" | "red" | "emerald">(
    "blue"
  );

  const [playerSearch, setPlayerSearch] = useState("");
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>("all");
  const [playerOverrides, setPlayerOverrides] = useState<Record<string, PlayerOverride>>({});
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerAuditRow | null>(null);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [playerSaveMessage, setPlayerSaveMessage] = useState("");

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
      await fetchAdminLogs();
      await fetchPlayerOverrides();
      await fetchProfiles();
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
      throw error;
    }

    if (!data) return;

    setImportMetadata({
      fileName: data.file_name ?? null,
      updatedAt: data.updated_at ?? null,
      updatedByEmail: data.updated_by_email ?? null,
    });

    if (data.data) {
      setMappedData(data.data as MappedSkyjoData);
    }
  };

  const fetchAdminLogs = async () => {
    const { data, error } = await supabase
      .from("skyjo_admin_logs")
      .select("id, created_at, title, description, tone, created_by_email")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.warn("Table skyjo_admin_logs absente ou inaccessible :", error);
      setLogStorageStatus("missing");
      return;
    }

    setLogStorageStatus("ready");
    setPersistedLogs(
      (data ?? []).map((log: any) => ({
        id: log.id,
        created_at: log.created_at,
        date: log.created_at ? formatDateTime(log.created_at) : "—",
        title: log.title,
        description: log.description,
        tone: log.tone ?? "blue",
        created_by_email: log.created_by_email ?? null,
      }))
    );
  };

  const fetchPlayerOverrides = async () => {
    const { data, error } = await supabase
      .from("skyjo_player_overrides")
      .select(
        "joueur_id, display_name, email, status, role, updated_at, updated_by_email"
      );

    if (error) {
      console.warn("Table skyjo_player_overrides absente ou inaccessible :", error);
      setPlayerOverrides({});
      return;
    }

    const nextOverrides: Record<string, PlayerOverride> = {};

    (data ?? []).forEach((override: any) => {
      if (!override.joueur_id) return;

      nextOverrides[String(override.joueur_id)] = {
        joueur_id: String(override.joueur_id),
        display_name: override.display_name ?? null,
        email: override.email ?? null,
        status: override.status ?? null,
        role: override.role ?? null,
        updated_at: override.updated_at ?? null,
        updated_by_email: override.updated_by_email ?? null,
      };
    });

    setPlayerOverrides(nextOverrides);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, email, role");

    if (error) {
      console.warn("Table profiles absente ou inaccessible :", error);
      setProfiles([]);
      return;
    }

    setProfiles(
      (data ?? []).map((profile: any) => ({
        user_id: String(profile.user_id ?? ""),
        email: String(profile.email ?? "").trim().toLowerCase(),
        role: String(profile.role ?? "user"),
      }))
    );
  };

  const handleRefreshDataset = async () => {
    setRefreshingDataset(true);
    setRefreshMessage("");

    try {
      await fetchImportMetadata();
      await fetchAdminLogs();
      await fetchPlayerOverrides();
      await fetchProfiles();

      await writeAdminLog(
        "Dataset rafraîchi",
        "Dataset, logs et overrides joueurs rechargés depuis Supabase.",
        "blue"
      );

      setRefreshTone("emerald");
      setRefreshMessage("Dataset, logs et overrides joueurs rafraîchis avec succès.");
    } catch (error) {
      console.error(error);
      setRefreshTone("red");
      setRefreshMessage("Erreur pendant le rafraîchissement du dataset.");
    } finally {
      setRefreshingDataset(false);

      window.setTimeout(() => {
        setRefreshMessage("");
      }, 3500);
    }
  };

  const writeAdminLog = async (
    title: string,
    description: string,
    tone: AdminLog["tone"]
  ) => {
    const optimisticLog: AdminLog = {
      date: formatDateTime(new Date().toISOString()),
      title,
      description,
      tone,
      created_by_email: userEmail ?? null,
    };

    setPersistedLogs((current) => [optimisticLog, ...current].slice(0, 30));

    const { error } = await supabase.from("skyjo_admin_logs").insert({
      title,
      description,
      tone,
      created_by_email: userEmail ?? null,
    });

    if (error) {
      console.warn(
        "Log non persisté. Crée la table skyjo_admin_logs si tu veux les logs en base.",
        error
      );
      setLogStorageStatus("missing");
      return;
    }

    setLogStorageStatus("ready");
    await fetchAdminLogs();
  };

  const savePlayerOverride = async (
    player: PlayerAuditRow,
    values: PlayerOverrideForm
  ) => {
    setSavingPlayer(true);
    setPlayerSaveMessage("");

    try {
      const payload = {
        joueur_id: player.id,
        display_name: values.displayName.trim() || player.name,
        email: values.email.trim() || null,
        status: values.status,
        role: values.role,
        updated_at: new Date().toISOString(),
        updated_by_email: userEmail ?? null,
      };

      const { error } = await supabase
        .from("skyjo_player_overrides")
        .upsert(payload, { onConflict: "joueur_id" });

      if (error) {
        console.error("Erreur sauvegarde override joueur :", error);
        setPlayerSaveMessage("Sauvegarde impossible. Vérifie les droits RLS sur skyjo_player_overrides.");
        return;
      }

      setPlayerOverrides((current) => ({
        ...current,
        [player.id]: payload,
      }));

      setSelectedPlayer((current) =>
        current
          ? {
              ...current,
              name: payload.display_name,
              email: payload.email ?? "—",
              status: payload.status,
              role: payload.role,
            }
          : current
      );

      setPlayerSaveMessage("Joueur sauvegardé avec succès.");
      await writeAdminLog(
        "Override joueur sauvegardé",
        `${payload.display_name} a été mis à jour depuis l’Admin.`,
        "emerald"
      );
    } finally {
      setSavingPlayer(false);

      window.setTimeout(() => {
        setPlayerSaveMessage("");
      }, 3500);
    }
  };

  const qualityIssues = useMemo(() => {
    return mappedData ? buildQualityIssues(mappedData) : [];
  }, [mappedData]);

  const pendingQualityIssues = useMemo(() => {
    return pendingImport ? buildQualityIssues(pendingImport.appData) : [];
  }, [pendingImport]);

  const selectedIssue = useMemo(() => {
    return qualityIssues.find((issue) => issue.id === selectedIssueId) ?? null;
  }, [qualityIssues, selectedIssueId]);

  const datasetSummary = useMemo(() => {
    return buildDatasetSummary(mappedData);
  }, [mappedData]);

  const pendingSummary = useMemo(() => {
    return buildDatasetSummary(pendingImport?.appData ?? null);
  }, [pendingImport]);

  const playerAuditRows = useMemo(() => {
    return mappedData
      ? buildPlayerAuditRows(mappedData, playerOverrides, profiles)
      : [];
  }, [mappedData, playerOverrides, profiles]);

  const filteredPlayerAuditRows = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();

    return playerAuditRows.filter((player) => {
      if (
        query &&
        !player.name.toLowerCase().includes(query) &&
        !player.email.toLowerCase().includes(query)
      ) {
        return false;
      }

      if (playerFilter === "duplicates") return player.duplicateGroupSize > 1;
      if (playerFilter === "unlinked") return player.status === "Non lié";
      if (playerFilter === "inactive") return player.status === "Inactif";

      return true;
    });
  }, [playerAuditRows, playerSearch, playerFilter]);

  const duplicatePlayerCount = playerAuditRows.filter(
    (player) => player.duplicateGroupSize > 1
  ).length;
  const unlinkedPlayerCount = playerAuditRows.filter(
    (player) => player.status === "Non lié"
  ).length;

  const computedLogs = useMemo<AdminLog[]>(() => {
    const logs: AdminLog[] = [];

    if (importMetadata.updatedAt) {
      logs.push({
        date: formatDateTime(importMetadata.updatedAt),
        title: "Dataset actif mis à jour",
        description: `${importMetadata.fileName ?? "Fichier inconnu"} importé par ${
          importMetadata.updatedByEmail ?? "utilisateur inconnu"
        }.`,
        tone: "emerald",
      });
    }

    if (mappedData) {
      logs.push({
        date: "Maintenant",
        title: "Mapping application disponible",
        description: `${mappedData.players.length} joueurs, ${mappedData.games.length} parties et ${mappedData.rivalries.length} rivalités prêtes pour l’app.`,
        tone: "blue",
      });
    }

    if (qualityIssues.length > 0) {
      const criticalCount = qualityIssues.filter(
        (issue) => issue.severity === "critical"
      ).length;

      logs.push({
        date: "Contrôle qualité",
        title:
          criticalCount > 0
            ? "Anomalies critiques détectées"
            : "Points de vigilance détectés",
        description: `${qualityIssues.length} contrôle${
          qualityIssues.length > 1 ? "s" : ""
        } à vérifier dans le dataset.`,
        tone: criticalCount > 0 ? "red" : "amber",
      });
    }

    if (logs.length === 0) {
      logs.push({
        date: "Initialisation",
        title: "Aucun dataset actif",
        description: "Importe un fichier Excel pour activer les analyses administrateur.",
        tone: "amber",
      });
    }

    return logs;
  }, [importMetadata, mappedData, qualityIssues]);

  const adminLogs = persistedLogs.length > 0 ? persistedLogs : computedLogs;

  const handleExcelUpload = async (file: File) => {
    setImportError("");
    setImportSuccess("");
    setRawExcelData(null);
    setSelectedIssueId(null);
    setPendingImport(null);
    setImporting(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);

      const missingSheets = expectedSheets.filter(
        (sheetName) => !workbook.Sheets[sheetName]
      );

      if (missingSheets.length > 0) {
        throw new Error(`Feuilles manquantes : ${missingSheets.join(", ")}`);
      }

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

      setRawExcelData(rawData);
      setPendingImport({
        fileName: file.name,
        updatedAt,
        rawData,
        appData,
      });

      setImportSuccess(
        "Fichier lu correctement. Confirme l’import pour remplacer le dataset actif."
      );
    } catch (error) {
      console.error(error);
      setImportError(
        error instanceof Error
          ? error.message
          : "Import impossible. Vérifie que le fichier contient bien T_JOUEURS, T_PARTIES et T_RESULTATS."
      );
    } finally {
      setImporting(false);
      setDragActive(false);
    }
  };

  const confirmPendingImport = async () => {
    if (!pendingImport) return;

    setConfirmingImport(true);
    setImportError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setImportError("Session expirée. Reconnecte-toi avant d’importer.");
        return;
      }

      const response = await fetch("/api/admin/import-skyjo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fileName: pendingImport.fileName,
          updatedAt: pendingImport.updatedAt,
          updatedByEmail: userEmail ?? null,
          rawData: pendingImport.rawData,
          appData: pendingImport.appData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setImportError(
          result?.error ??
            "Import lu correctement, mais sauvegarde relationnelle impossible."
        );
        return;
      }

      setMappedData(pendingImport.appData);
      setRawExcelData(pendingImport.rawData);

      setImportMetadata({
        fileName: pendingImport.fileName,
        updatedAt: pendingImport.updatedAt,
        updatedByEmail: userEmail ?? null,
      });

      const summary = result.summary;

      setImportSuccess(
        `Import relationnel réussi : ${summary.players} joueurs, ${summary.games} parties, ${summary.results} résultats.`
      );

      if (summary.warnings?.length > 0) {
        console.warn(
          "Import Skyjo - warnings :",
          summary.warnings
        );
      }

      if (summary.ignoredResults?.length > 0) {
        console.warn(
          "Import Skyjo - résultats ignorés :",
          summary.ignoredResults
        );
      }

      await writeAdminLog(
        "Import Excel confirmé",
        `${pendingImport.fileName} a remplacé le dataset actif et les tables relationnelles.`,
        pendingQualityIssues.length > 0 ? "amber" : "emerald"
      );

      setPendingImport(null);
    } catch (error) {
      console.error(error);

      setImportError(
        error instanceof Error
          ? error.message
          : "Erreur inconnue pendant l’import relationnel."
      );
    } finally {
      setConfirmingImport(false);
    }
  };

  const cancelPendingImport = async () => {
    if (pendingImport) {
      await writeAdminLog(
        "Import Excel annulé",
        `${pendingImport.fileName} a été lu mais non appliqué.`,
        "amber"
      );
    }

    setPendingImport(null);
    setRawExcelData(null);
    setImportSuccess("");
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      handleExcelUpload(file);
    }
  };

  const downloadBackup = () => {
    if (!mappedData) return;

    const blob = new Blob([JSON.stringify(mappedData, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `skyjo_dataset_backup_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(url);

    writeAdminLog(
      "Backup JSON téléchargé",
      "Un backup local du dataset actif a été généré.",
      "blue"
    );
  };

  const downloadLogsCsv = () => {
    const header = ["date", "titre", "description", "niveau", "email", "source"];
    const rows = adminLogs.map((log) => [
      log.date,
      log.title,
      log.description,
      log.tone,
      log.created_by_email ?? "",
      log.id ? "base" : "calculé écran",
    ]);

    downloadCsv(
      `skyjo_admin_logs_${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...rows]
    );

    writeAdminLog(
      "Logs exportés",
      "Le journal d’administration a été téléchargé au format CSV.",
      "blue"
    );
  };

  const downloadPlayersCsv = () => {
    const header = [
      "id",
      "joueur",
      "email",
      "statut",
      "role",
      "parties",
      "victoires",
      "doublons_potentiels",
      "derniere_activite",
    ];

    const rows = playerAuditRows.map((player) => [
      player.id,
      player.name,
      player.email,
      player.status,
      player.role,
      player.games,
      player.wins,
      player.duplicateGroupSize,
      player.lastActivity,
    ]);

    downloadCsv(
      `skyjo_joueurs_audit_${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...rows]
    );

    writeAdminLog(
      "Audit joueurs exporté",
      "Le fichier CSV de supervision joueurs a été téléchargé.",
      "blue"
    );
  };

  const downloadIssueCsv = (issue: QualityIssue) => {
    const header = [
      "controle",
      "partie",
      "date",
      "lieu",
      "joueurs",
      "description",
      "joueur",
      "score",
      "position",
      "statut",
    ];

    const rows = issue.details.flatMap((detail) => {
      if (detail.rows.length === 0) {
        return [
          [
            issue.title,
            detail.gameId,
            detail.gameDate,
            detail.location,
            detail.playersCount,
            detail.description,
            "",
            "",
            "",
            "",
          ],
        ];
      }

      return detail.rows.map((row) => [
        issue.title,
        detail.gameId,
        detail.gameDate,
        detail.location,
        detail.playersCount,
        detail.description,
        row.player,
        row.score,
        row.position,
        row.status,
      ]);
    });

    downloadCsv(
      `skyjo_anomalies_${issue.id}_${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...rows]
    );

    writeAdminLog(
      "Anomalies exportées",
      `Export CSV du contrôle "${issue.title}".`,
      "blue"
    );
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
      <div className="w-full max-w-full overflow-x-hidden space-y-8 sm:space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-amber-500/[0.08] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="absolute right-[-90px] top-[-90px] h-60 w-60 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute bottom-[-120px] left-[25%] h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/80">
                Administration
              </p>

              <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Centre de contrôle Skyjo League
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">
                Gestion du dataset, import Excel sécurisé, anomalies
                actionnables, supervision joueurs et logs exportables.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Badge>{userEmail ?? "Admin"}</Badge>
                <Badge tone={mappedData ? "emerald" : "amber"}>
                  {mappedData ? "Dataset actif" : "Dataset absent"}
                </Badge>
                <Badge tone="blue">Source · SharePoint Excel</Badge>
                <Badge tone={logStorageStatus === "ready" ? "emerald" : "amber"}>
                  Logs {logStorageStatus === "ready" ? "persistés" : "fallback écran"}
                </Badge>
                {qualityIssues.length > 0 && (
                  <Badge tone="red">{qualityIssues.length} alertes qualité</Badge>
                )}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <p className="text-xs text-zinc-500">Dernier import</p>
              <p className="mt-2 max-w-[260px] truncate text-xl font-semibold text-white">
                {importMetadata.fileName ?? "Aucun fichier"}
              </p>
              <p className="mt-1 text-sm text-amber-200">
                {importMetadata.updatedAt
                  ? formatDateTime(importMetadata.updatedAt)
                  : "En attente"}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <AdminKpi label="Parties" value={datasetSummary.games} subtitle="Dataset actif" tone="blue" />
          <AdminKpi label="Joueurs" value={datasetSummary.players} subtitle="Profils importés" tone="emerald" />
          <AdminKpi label="Doublons joueurs" value={duplicatePlayerCount} subtitle="À surveiller" tone={duplicatePlayerCount > 0 ? "amber" : "emerald"} />
          <AdminKpi label="Non liés email" value={unlinkedPlayerCount} subtitle="Comptes à rattacher" tone={unlinkedPlayerCount > 0 ? "violet" : "emerald"} />
          <AdminKpi label="Contrôle qualité" value={qualityIssues.length} subtitle={qualityIssues.length > 0 ? "À vérifier" : "RAS"} tone={qualityIssues.length > 0 ? "amber" : "emerald"} />
          <AdminKpi label="Statut" value={mappedData ? "OK" : "Vide"} subtitle={mappedData ? "Mapping prêt" : "Import requis"} tone={mappedData ? "emerald" : "amber"} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Import Excel sécurisé
                </p>

                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Charger les données Skyjo
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                  Le fichier est d’abord lu et contrôlé. Le dataset actif n’est
                  remplacé qu’après confirmation explicite.
                </p>
              </div>

              <StatusPill
                label={
                  importing
                    ? "Lecture en cours"
                    : pendingImport
                      ? "Confirmation requise"
                      : mappedData
                        ? "Actif"
                        : "À importer"
                }
                tone={
                  importing
                    ? "blue"
                    : pendingImport
                      ? "amber"
                      : mappedData
                        ? "emerald"
                        : "amber"
                }
              />
            </div>

            <label
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={handleDrop}
              className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed px-6 py-10 text-center transition ${
                dragActive
                  ? "border-amber-300/50 bg-amber-400/10"
                  : "border-white/15 bg-black/20 hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-4xl">📥</span>
              <span className="mt-4 text-sm font-semibold text-white">
                {importing
                  ? "Lecture du fichier..."
                  : "Glisser-déposer ou sélectionner un fichier .xlsx"}
              </span>
              <span className="mt-2 text-xs text-zinc-500">
                Feuilles attendues : T_JOUEURS, T_PARTIES, T_RESULTATS
              </span>

              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                disabled={importing || confirmingImport}
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
              <AlertBox tone="red" title="Import impossible">
                {importError}
              </AlertBox>
            )}

            {importSuccess && (
              <AlertBox tone="emerald" title={pendingImport ? "Fichier prêt" : "Import réussi"}>
                {importSuccess}
              </AlertBox>
            )}

            {pendingImport && (
              <PendingImportPanel
                pendingImport={pendingImport}
                summary={pendingSummary}
                qualityIssues={pendingQualityIssues}
                confirmingImport={confirmingImport}
                onConfirm={confirmPendingImport}
                onCancel={cancelPendingImport}
              />
            )}

            {rawExcelData && (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <RawCountCard label="T_JOUEURS" value={rawExcelData.joueurs.length} tone="emerald" />
                <RawCountCard label="T_PARTIES" value={rawExcelData.parties.length} tone="blue" />
                <RawCountCard label="T_RESULTATS" value={rawExcelData.resultats.length} tone="amber" />
              </div>
            )}
          </article>

          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Dataset actif
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Snapshot
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Informations du dernier fichier sauvegardé dans Supabase.
                </p>
              </div>

              <StatusPill
                label={importMetadata.updatedAt ? "Sauvegardé" : "Vide"}
                tone={importMetadata.updatedAt ? "emerald" : "amber"}
              />
            </div>

            <div className="mt-6 space-y-3">
              <MetadataCard label="Fichier" value={importMetadata.fileName ?? "Aucun fichier chargé"} />
              <MetadataCard label="Chargé le" value={importMetadata.updatedAt ? formatDateTime(importMetadata.updatedAt) : "—"} />
              <MetadataCard label="Chargé par" value={importMetadata.updatedByEmail ?? "—"} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRefreshDataset}
                disabled={refreshingDataset}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-300"
              >
                {refreshingDataset ? "Rafraîchissement..." : "Rafraîchir"}
              </button>

              <button
                type="button"
                onClick={downloadBackup}
                disabled={!mappedData}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.04] disabled:hover:text-zinc-300"
              >
                Télécharger backup
              </button>
            </div>

            {refreshMessage && (
              <RefreshFeedback tone={refreshTone}>{refreshMessage}</RefreshFeedback>
            )}
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Contrôle qualité
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Santé du dataset
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Clique sur une anomalie pour voir les parties concernées et
                  ouvrir la page parties.
                </p>
              </div>

              <StatusPill
                label={qualityIssues.length > 0 ? "À vérifier" : "RAS"}
                tone={qualityIssues.length > 0 ? "amber" : "emerald"}
              />
            </div>

            <div className="mt-6 space-y-3">
              {qualityIssues.length === 0 ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                  <p className="text-sm font-semibold text-emerald-100">
                    Aucun problème détecté
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/70">
                    Les contrôles automatiques disponibles ne remontent aucune
                    anomalie sur le dataset actif.
                  </p>
                </div>
              ) : (
                qualityIssues.map((issue) => (
                  <QualityIssueCard
                    key={issue.id}
                    issue={issue}
                    active={selectedIssueId === issue.id}
                    onClick={() =>
                      setSelectedIssueId((current) =>
                        current === issue.id ? null : issue.id
                      )
                    }
                  />
                ))
              )}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
            {!selectedIssue ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                    Debug qualité
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">
                    Détail des anomalies
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Sélectionne une carte qualité à gauche pour afficher les
                    parties concernées, les lignes joueurs et les valeurs à
                    vérifier.
                  </p>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
                  <p className="text-4xl">🔎</p>
                  <p className="mt-4 text-sm font-semibold text-white">
                    Aucun contrôle sélectionné
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Les anomalies deviennent actionnables ici.
                  </p>
                </div>
              </>
            ) : (
              <QualityIssueDetailPanel
                issue={selectedIssue}
                onClose={() => setSelectedIssueId(null)}
                onExport={() => downloadIssueCsv(selectedIssue)}
              />
            )}
          </article>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Gestion joueurs
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Audit joueurs, doublons et rattachement email
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                Cette vue prépare la vraie gestion joueurs : doublons potentiels,
                comptes non liés, activité et export CSV pour correction dans
                le fichier source ou future table d’overrides.
              </p>
            </div>

            <button
              type="button"
              onClick={downloadPlayersCsv}
              disabled={!mappedData}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.04] disabled:hover:text-zinc-300"
            >
              Export audit joueurs
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_260px]">
            <input
              value={playerSearch}
              onChange={(event) => setPlayerSearch(event.target.value)}
              placeholder="Rechercher un joueur ou un email..."
              className="h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/50"
            />

            <AdminSelect
              value={playerFilter}
              onChange={(value) => setPlayerFilter(value as PlayerFilter)}
              options={playerFilterOptions}
            />
          </div>

          <div className="mt-6 grid gap-3">
            {filteredPlayerAuditRows.slice(0, 12).map((player) => (
              <PlayerAuditCard
                key={player.id}
                player={player}
                onClick={() => setSelectedPlayer(player)}
              />
            ))}

            {filteredPlayerAuditRows.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-zinc-500">
                Aucun joueur ne correspond au filtre.
              </div>
            )}

            {filteredPlayerAuditRows.length > 12 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                {filteredPlayerAuditRows.length - 12} joueur
                {filteredPlayerAuditRows.length - 12 > 1 ? "s" : ""} non affiché
                {filteredPlayerAuditRows.length - 12 > 1 ? "s" : ""}. Utilise l’export CSV pour la liste complète.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Logs
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Journal d’administration
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Historique exportable. La persistance en base nécessite la
                  table skyjo_admin_logs.
                </p>
              </div>

              <button
                type="button"
                onClick={downloadLogsCsv}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white hover:text-slate-950"
              >
                Télécharger logs
              </button>
            </div>

            {logStorageStatus === "missing" && (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100/80">
                Les logs sont affichés et exportables, mais pas encore persistés
                en base. Crée la table <span className="font-semibold">skyjo_admin_logs</span> pour activer la persistance.
              </div>
            )}

            <div className="mt-6 space-y-3">
              {adminLogs.map((log, index) => (
                <AdminLogCard key={`${log.title}-${index}`} log={log} />
              ))}
            </div>
          </article>

          {mappedData && (
            <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Joueurs
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Top activité
                </h2>
              </div>

              <div className="mt-6 space-y-3">
                {getTopPlayers(mappedData).map((player, index) => (
                  <TopPlayerRow
                    key={player.name}
                    rank={index + 1}
                    name={player.name}
                    games={player.games}
                    wins={player.wins}
                  />
                ))}
              </div>
            </article>
          )}
        </section>

        {selectedPlayer && (
          <PlayerEditDrawer
            player={selectedPlayer}
            saving={savingPlayer}
            message={playerSaveMessage}
            onClose={() => {
              setSelectedPlayer(null);
              setPlayerSaveMessage("");
            }}
            onSave={(values) => savePlayerOverride(selectedPlayer, values)}
          />
        )}
      </div>
    </AppShell>
  );
}

function PendingImportPanel({
  pendingImport,
  summary,
  qualityIssues,
  confirmingImport,
  onConfirm,
  onCancel,
}: {
  pendingImport: PendingImport;
  summary: ReturnType<typeof buildDatasetSummary>;
  qualityIssues: QualityIssue[];
  confirmingImport: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const criticalCount = qualityIssues.filter(
    (issue) => issue.severity === "critical"
  ).length;

  return (
    <div className="mt-6 rounded-[1.5rem] border border-amber-400/20 bg-amber-400/10 p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/70">
            Confirmation requise
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Remplacer le dataset actif ?
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/75">
            Le fichier{" "}
            <span className="font-semibold text-amber-100">
              {pendingImport.fileName}
            </span>{" "}
            a été lu. Confirme uniquement si tu veux remplacer les données
            actuellement utilisées par toutes les pages du dashboard.
          </p>
        </div>

        <StatusPill
          label={criticalCount > 0 ? `${criticalCount} critique(s)` : "Prêt"}
          tone={criticalCount > 0 ? "red" : "emerald"}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <MiniImportStat label="Joueurs" value={summary.players} />
        <MiniImportStat label="Parties" value={summary.games} />
        <MiniImportStat label="Rivalités" value={summary.rivalries} />
        <MiniImportStat label="Alertes" value={qualityIssues.length} />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmingImport}
          className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {confirmingImport ? "Remplacement en cours..." : "Confirmer et remplacer"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={confirmingImport}
          className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function MiniImportStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function RefreshFeedback({
  tone,
  children,
}: {
  tone: "blue" | "red" | "emerald";
  children: ReactNode;
}) {
  const className = {
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-100",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    red: "border-red-400/20 bg-red-400/10 text-red-100",
  }[tone];

  return (
    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${className}`}>
      {children}
    </div>
  );
}

function PlayerAuditCard({
  player,
  onClick,
}: {
  player: PlayerAuditRow;
  onClick: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-blue-400/25 hover:bg-white/[0.035]">
      <div className="grid gap-4 xl:grid-cols-[minmax(120px,0.8fr)_minmax(0,3fr)_auto] xl:items-center">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white sm:text-lg">
            {player.name}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 sm:text-xs">
            ID {player.id}
          </p>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          <InfoBlock label="Email" value={player.email} />
          <InfoBlock
            label="Activité"
            value={`${player.games} parties · ${player.wins} victoires`}
          />
          <InfoBlock label="Dernière" value={player.lastActivity} />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
          <StatusPill
            label={player.status}
            tone={
              player.status === "Actif"
                ? "emerald"
                : player.status === "Inactif"
                  ? "amber"
                  : "blue"
            }
          />

          <StatusPill
            label={player.role}
            tone={player.role === "Admin" ? "red" : "blue"}
          />

          {player.duplicateGroupSize > 1 && (
            <StatusPill label="Doublon ?" tone="red" />
          )}

          <button
            type="button"
            onClick={onClick}
            className="rounded-xl border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-400/20"
          >
            Afficher
          </button>
        </div>
      </div>
    </article>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:text-[10px]">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-zinc-200 sm:text-sm">
        {value || "—"}
      </p>
    </div>
  );
}

function PlayerEditDrawer({
  player,
  saving,
  message,
  onClose,
  onSave,
}: {
  player: PlayerAuditRow;
  saving: boolean;
  message: string;
  onClose: () => void;
  onSave: (values: PlayerOverrideForm) => void;
}) {
  const [displayName, setDisplayName] = useState(player.name);
  const [email, setEmail] = useState(player.email === "—" ? "" : player.email);
  const [status, setStatus] = useState<PlayerOverrideForm["status"]>(player.status);
  const [role, setRole] = useState<PlayerOverrideForm["role"]>(player.role);

  useEffect(() => {
    setDisplayName(player.name);
    setEmail(player.email === "—" ? "" : player.email);
    setStatus(player.status);
    setRole(player.role);
  }, [player]);

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Fermer l’édition joueur"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#020617] p-6 shadow-[-30px_0_100px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-300/70">
              Édition joueur
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {player.name}
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              ID joueur : {player.id}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white hover:text-slate-950"
          >
            Fermer
          </button>
        </div>

        <div className="mt-8 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Nom affiché
            </label>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-semibold text-white outline-none transition focus:border-blue-400/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Email
            </label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="prenom.nom@seenovate.com"
              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Statut
              </label>
              <div className="mt-2">
                <AdminSelect
                  value={status}
                  onChange={(value) => setStatus(value as PlayerOverrideForm["status"])}
                  options={[
                    { value: "Actif", label: "Actif" },
                    { value: "Inactif", label: "Inactif" },
                    { value: "Non lié", label: "Non lié" },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Rôle
              </label>
              <div className="mt-2">
                <AdminSelect
                  value={role}
                  onChange={(value) => setRole(value as PlayerOverrideForm["role"])}
                  options={[
                    { value: "Joueur", label: "Joueur" },
                    { value: "Admin", label: "Admin" },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Statistiques importées
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniImportStat label="Parties" value={player.games} />
              <MiniImportStat label="Victoires" value={player.wins} />
              <MiniImportStat label="Dernière" value={player.lastActivity} />
            </div>
          </div>

          {message && (
            <RefreshFeedback tone={message.includes("impossible") ? "red" : "emerald"}>
              {message}
            </RefreshFeedback>
          )}
        </div>

        <div className="mt-auto grid gap-3 pt-6 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white hover:text-slate-950"
          >
            Annuler
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                displayName,
                email,
                status,
                role,
              })
            }
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function QualityIssueCard({
  issue,
  active,
  onClick,
}: {
  issue: QualityIssue;
  active: boolean;
  onClick: () => void;
}) {
  const className = {
    critical:
      "border-red-400/25 bg-red-400/10 text-red-100 hover:border-red-300/45 hover:bg-red-400/15",
    warning:
      "border-amber-400/25 bg-amber-400/10 text-amber-100 hover:border-amber-300/45 hover:bg-amber-400/15",
    info:
      "border-blue-400/25 bg-blue-400/10 text-blue-100 hover:border-blue-300/45 hover:bg-blue-400/15",
  }[issue.severity];

  const activeClass = active
    ? "ring-2 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_80px_rgba(0,0,0,0.35)]"
    : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-2xl border p-4 text-left transition ${className} ${activeClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{issue.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-75">{issue.description}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] opacity-55">
            {active ? "Détail ouvert" : "Cliquer pour analyser"}
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold">
          {issue.count}
        </span>
      </div>
    </button>
  );
}

function QualityIssueDetailPanel({
  issue,
  onClose,
  onExport,
}: {
  issue: QualityIssue;
  onClose: () => void;
  onExport: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
            Debug qualité
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {issue.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            {issue.description}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onExport}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-white hover:text-slate-950"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-400 transition hover:bg-white hover:text-slate-950"
          >
            Fermer
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {issue.details.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
            Aucun détail disponible pour ce contrôle.
          </div>
        ) : (
          issue.details.slice(0, 12).map((detail, index) => (
            <IssueGameCard key={`${detail.gameId}-${index}`} detail={detail} />
          ))
        )}

        {issue.details.length > 12 && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            {issue.details.length - 12} anomalie
            {issue.details.length - 12 > 1 ? "s" : ""} supplémentaire
            {issue.details.length - 12 > 1 ? "s" : ""}. Utilise l’export CSV
            pour tout consulter.
          </div>
        )}
      </div>
    </div>
  );
}

function IssueGameCard({ detail }: { detail: QualityIssueDetail }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold text-white">Partie {detail.gameId}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {detail.gameDate} · {detail.location} · {detail.playersCount} joueurs
          </p>
        </div>

        <Link
          href={`/games?gameId=${encodeURIComponent(detail.gameId)}`}
          className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-200 transition hover:bg-blue-400/20"
        >
          Ouvrir la partie
        </Link>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-400">
        {detail.description}
      </p>

      {detail.rows.length > 0 && (
        <div className="mt-4 grid gap-2">
          {detail.rows.map((row, index) => (
            <div
              key={`${row.player}-${index}`}
              className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm sm:grid-cols-[1.2fr_0.7fr_0.7fr_1fr]"
            >
              <span className="truncate font-semibold text-white">{row.player}</span>
              <span className="text-zinc-400">Score {row.score}</span>
              <span className="text-zinc-400">Pos. {row.position}</span>
              <span className="text-amber-200">{row.status}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function AdminKpi({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  tone: "blue" | "emerald" | "amber" | "violet" | "red";
}) {
  const toneClass = {
    blue: "text-blue-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
    red: "text-red-300",
  }[tone];

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-3 truncate text-3xl font-semibold ${toneClass}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>
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

function RawCountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "blue" | "amber";
}) {
  const className = {
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-100",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function AlertBox({
  tone,
  title,
  children,
}: {
  tone: "red" | "emerald";
  title: string;
  children: ReactNode;
}) {
  const className = {
    red: "border-red-400/20 bg-red-400/10 text-red-100",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  }[tone];

  return (
    <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${className}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 opacity-80">{children}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "emerald" | "amber" | "blue" | "red";
}) {
  const className = {
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    red: "border-red-400/20 bg-red-400/10 text-red-200",
  }[tone];

  return (
    <span className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function AdminLogCard({ log }: { log: AdminLog }) {
  const dotClass = {
    emerald: "bg-emerald-400",
    blue: "bg-blue-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
  }[log.tone];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex gap-3">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">{log.date}</p>
          <p className="mt-1 font-semibold text-white">{log.title}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{log.description}</p>
        </div>
      </div>
    </div>
  );
}

function TopPlayerRow({
  rank,
  name,
  games,
  wins,
}: {
  rank: number;
  name: string;
  games: number;
  wins: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold text-white">
          #{rank}
        </div>

        <div className="min-w-0">
          <p className="truncate font-medium text-white">{name}</p>
          <p className="text-xs text-zinc-500">{wins} victoires</p>
        </div>
      </div>

      <p className="shrink-0 text-sm font-semibold text-blue-200">
        {games} parties
      </p>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "blue" | "emerald" | "amber" | "red";
}) {
  const className = {
    default: "border-white/10 bg-white/[0.06] text-zinc-300",
    blue: "border-blue-400/20 bg-blue-400/10 text-blue-200",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    red: "border-red-400/20 bg-red-400/10 text-red-200",
  }[tone];

  return (
    <div className={`max-w-full truncate rounded-full border px-4 py-2 text-xs font-medium ${className}`}>
      {children}
    </div>
  );
}

function AdminSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-semibold outline-none transition ${
          open
            ? "border-blue-400/60 bg-[#0B1120] shadow-[0_0_0_4px_rgba(59,130,246,0.10)]"
            : "border-white/10 bg-black/20 hover:border-blue-400/40 hover:bg-white/[0.04]"
        } text-white`}
      >
        <span className="truncate">{selected?.label ?? "Sélectionner"}</span>

        <span
          className={`shrink-0 text-xs text-zinc-500 transition ${
            open ? "rotate-180 text-blue-300" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
          />

          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#060B16] p-1 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-blue-500/15 text-blue-200"
                      : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>

                  {active && (
                    <span className="ml-3 shrink-0 text-xs text-blue-300">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function buildDatasetSummary(data: MappedSkyjoData | null) {
  if (!data) {
    return {
      players: "—",
      games: "—",
      rivalries: "—",
      seasons: "—",
    };
  }

  const seasons = new Set(
    (data.games ?? [])
      .map((game: any) => getGameSeason(game))
      .filter(Boolean)
  );

  return {
    players: data.players.length,
    games: data.games.length,
    rivalries: data.rivalries.length,
    seasons: seasons.size,
  };
}

function buildQualityIssues(data: MappedSkyjoData): QualityIssue[] {
  const games = (data.games ?? []) as any[];
  const issues: QualityIssue[] = [];

  const missingDateDetails = games
    .filter((game) => !getGameDateValue(game))
    .map((game, index) =>
      buildIssueDetail(
        game,
        "La partie n’a pas de date exploitable. Elle ne pourra pas être rattachée correctement à une saison.",
        index
      )
    );

  const missingResultsDetails = games
    .filter((game) => !Array.isArray(game.results) || game.results.length === 0)
    .map((game, index) =>
      buildIssueDetail(
        game,
        "La partie existe mais ne contient aucune ligne de résultat.",
        index
      )
    );

  const duplicatePlayerDetails = games
    .map((game, index) => {
      const results = Array.isArray(game.results) ? game.results : [];
      const names: string[] = results
        .map((result: any) => getResultName(result))
        .filter((name: string) => name.trim() !== "");

      const duplicateNames = names.filter(
        (name: string, nameIndex: number) => names.indexOf(name) !== nameIndex
      );
      const uniqueDuplicateNames = Array.from(new Set(duplicateNames));

      if (uniqueDuplicateNames.length === 0) return null;

      return buildIssueDetail(
        game,
        `Joueur(s) dupliqué(s) dans cette partie : ${uniqueDuplicateNames.join(", ")}.`,
        index,
        results.filter((result: any) =>
          uniqueDuplicateNames.includes(getResultName(result))
        )
      );
    })
    .filter((detail): detail is QualityIssueDetail => Boolean(detail));

  const missingScoreDetails = games
    .map((game, index) => {
      const results = Array.isArray(game.results) ? game.results : [];
      const rows = results.filter(
        (result: any) => !Number.isFinite(toNumber(result.score ?? result.Score))
      );

      if (rows.length === 0) return null;

      return buildIssueDetail(
        game,
        `${rows.length} ligne(s) de résultat sans score exploitable.`,
        index,
        rows
      );
    })
    .filter((detail): detail is QualityIssueDetail => Boolean(detail));

  const missingPositionDetails = games
    .map((game, index) => {
      const results = Array.isArray(game.results) ? game.results : [];
      const rows = results.filter(
        (result: any) =>
          !Number.isFinite(
            toNumber(result.position ?? result.Position ?? result.rank ?? result.Rang)
          )
      );

      if (rows.length === 0) return null;

      return buildIssueDetail(
        game,
        `${rows.length} ligne(s) de résultat sans position exploitable.`,
        index,
        rows
      );
    })
    .filter((detail): detail is QualityIssueDetail => Boolean(detail));

  const severalWinnerDetails = games
    .map((game, index) => {
      const results = Array.isArray(game.results) ? game.results : [];
      const rows = results.filter((result: any) => isWinnerResult(result));

      if (rows.length <= 1) return null;

      return buildIssueDetail(
        game,
        `${rows.length} joueurs sont marqués gagnants sur cette partie.`,
        index,
        rows
      );
    })
    .filter((detail): detail is QualityIssueDetail => Boolean(detail));

  if (missingDateDetails.length > 0) {
    issues.push({
      id: "missing-date",
      severity: "critical",
      title: "Parties sans date",
      description: "Certaines parties ne pourront pas être rattachées à une saison.",
      count: missingDateDetails.length,
      details: missingDateDetails,
    });
  }

  if (missingResultsDetails.length > 0) {
    issues.push({
      id: "missing-results",
      severity: "critical",
      title: "Parties sans résultats",
      description: "Des parties existent sans lignes de résultats associées.",
      count: missingResultsDetails.length,
      details: missingResultsDetails,
    });
  }

  if (duplicatePlayerDetails.length > 0) {
    issues.push({
      id: "duplicate-players",
      severity: "warning",
      title: "Joueurs dupliqués dans une partie",
      description: "Un même joueur apparaît plusieurs fois dans certaines parties.",
      count: duplicatePlayerDetails.length,
      details: duplicatePlayerDetails,
    });
  }

  if (missingScoreDetails.length > 0) {
    issues.push({
      id: "missing-score",
      severity: "warning",
      title: "Scores manquants",
      description: "Certaines lignes de résultats n’ont pas de score exploitable.",
      count: missingScoreDetails.reduce(
        (sum, detail) => sum + detail.rows.length,
        0
      ),
      details: missingScoreDetails,
    });
  }

  if (missingPositionDetails.length > 0) {
    issues.push({
      id: "missing-position",
      severity: "info",
      title: "Positions manquantes",
      description: "Certaines lignes n’ont pas de position. Le score sera utilisé en secours.",
      count: missingPositionDetails.reduce(
        (sum, detail) => sum + detail.rows.length,
        0
      ),
      details: missingPositionDetails,
    });
  }

  if (severalWinnerDetails.length > 0) {
    issues.push({
      id: "several-winners",
      severity: "warning",
      title: "Plusieurs gagnants explicites",
      description: "Certaines parties contiennent plusieurs lignes marquées comme gagnantes.",
      count: severalWinnerDetails.length,
      details: severalWinnerDetails,
    });
  }

  return issues;
}

function buildIssueDetail(
  game: any,
  description: string,
  fallbackIndex: number,
  rows?: any[]
): QualityIssueDetail {
  const timestamp = getGameDateValue(game);
  const gameRows = rows ?? (Array.isArray(game.results) ? game.results : []);

  return {
    gameId: String(
      game.id ?? game.PartieID ?? game.partieID ?? `#${fallbackIndex + 1}`
    ),
    gameDate: timestamp ? formatDate(new Date(timestamp)) : "Date inconnue",
    location: String(
      game.location ?? game.lieu ?? game.Lieu ?? game.place ?? "Lieu non renseigné"
    ).trim(),
    playersCount: String(game.players ?? game.NbJoueurs ?? game.nbJoueurs ?? "—"),
    description,
    rows: gameRows.map((result: any) => ({
      player: getResultName(result) || "Joueur inconnu",
      score: formatValue(result.score ?? result.Score),
      position: formatValue(
        result.position ?? result.Position ?? result.rank ?? result.Rang
      ),
      status: isWinnerResult(result) ? "Gagnant explicite" : "Ligne à vérifier",
    })),
  };
}

function buildPlayerAuditRows(
  data: MappedSkyjoData,
  overrides: Record<string, PlayerOverride>,
  profiles: ProfileRow[]
): PlayerAuditRow[] {
  const games = (data.games ?? []) as any[];
  const stats = new Map<
    string,
    {
      games: number;
      wins: number;
      lastActivityTimestamp: number | null;
    }
  >();

  games.forEach((game) => {
    const timestamp = getGameDateValue(game);
    const results = Array.isArray(game.results) ? game.results : [];

    results.forEach((result: any) => {
      const name = getResultName(result);
      if (!name) return;

      if (!stats.has(name)) {
        stats.set(name, {
          games: 0,
          wins: 0,
          lastActivityTimestamp: null,
        });
      }

      const row = stats.get(name);
      if (!row) return;

      row.games += 1;
      if (isWinnerResult(result)) row.wins += 1;

      if (timestamp) {
        row.lastActivityTimestamp =
          row.lastActivityTimestamp === null
            ? timestamp
            : Math.max(row.lastActivityTimestamp, timestamp);
      }
    });
  });

  const players = (data.players ?? []) as any[];
  const normalizedCounts = new Map<string, number>();
  const profileByEmail = new Map(
    profiles
      .filter((profile) => profile.email)
      .map((profile) => [profile.email.toLowerCase(), profile])
  );

  players.forEach((player) => {
    const name = getPlayerName(player);
    const normalized = normalizeName(name);
    if (!normalized) return;
    normalizedCounts.set(normalized, (normalizedCounts.get(normalized) ?? 0) + 1);
  });

  return players
    .map((player, index) => {
      const name = getPlayerName(player);
      const normalizedName = normalizeName(name);
      const playerStats = stats.get(name);
      const gamesCount =
        playerStats?.games ?? Number(player.games ?? player.parties ?? 0);
      const lastActivityTimestamp = playerStats?.lastActivityTimestamp ?? null;

      const id = String(
        player.joueurId ??
          player.JoueurID ??
          player.joueurID ??
          player.id ??
          `player-${index + 1}`
      );
      const override = overrides[id];
      const explicitStatus = String(player.status ?? player.Statut ?? "").trim();
      const sourceEmail = String(
        player.email ?? player.Email ?? player.mail ?? player.Mail ?? ""
      ).trim();
      const email = normalizeOptionalText(override?.email) || sourceEmail || "—";
      const linkedProfile =
        email !== "—" ? profileByEmail.get(email.toLowerCase()) : undefined;
      const resolvedName =
        normalizeOptionalText(override?.display_name) || name || "Joueur sans nom";
      const inferredStatus = inferPlayerAuditStatus(
        explicitStatus,
        gamesCount,
        lastActivityTimestamp,
        email
      );
      const resolvedStatus =
        normalizePlayerStatus(override?.status) ??
        (linkedProfile ? inferredStatus : "Non lié");
      const resolvedRole = normalizePlayerRole(
        override?.role ?? linkedProfile?.role
      );

      return {
        id,
        name: resolvedName,
        normalizedName,
        email,
        status: resolvedStatus,
        role: resolvedRole,
        games: gamesCount,
        wins: playerStats?.wins ?? Number(player.wins ?? player.victoires ?? 0),
        duplicateGroupSize: normalizedCounts.get(normalizedName) ?? 1,
        lastActivity: formatLastActivity(lastActivityTimestamp),
      };
    })
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name, "fr"));
}

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? "").trim();

  return text.length > 0 ? text : "";
}

function normalizePlayerStatus(value: unknown): PlayerAuditRow["status"] | null {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "actif") return "Actif";
  if (text === "inactif") return "Inactif";
  if (text === "non lié" || text === "non lie") return "Non lié";

  return null;
}

function normalizePlayerRole(value: unknown): PlayerAuditRow["role"] {
  const text = String(value ?? "").trim().toLowerCase();

  if (text === "admin") return "Admin";

  return "Joueur";
}

function inferPlayerAuditStatus(
  explicitStatus: string,
  games: number,
  lastActivityTimestamp: number | null,
  email: string
): PlayerAuditRow["status"] {
  const normalizedStatus = explicitStatus.toLowerCase();

  if (normalizedStatus.includes("inactif")) return "Inactif";
  if (!email || email === "—") return "Non lié";

  if (!lastActivityTimestamp) {
    return games > 0 ? "Actif" : "Inactif";
  }

  const diffDays = Math.floor(
    (startOfDay(new Date()).getTime() -
      startOfDay(new Date(lastActivityTimestamp)).getTime()) /
      86_400_000
  );

  if (diffDays >= 45) return "Inactif";

  return "Actif";
}

function getTopPlayers(data: MappedSkyjoData) {
  const stats = new Map<string, { name: string; games: number; wins: number }>();

  (data.games ?? []).forEach((game: any) => {
    const results = Array.isArray(game.results) ? game.results : [];

    results.forEach((result: any) => {
      const name = getResultName(result);
      if (!name) return;

      if (!stats.has(name)) {
        stats.set(name, { name, games: 0, wins: 0 });
      }

      const row = stats.get(name);
      if (!row) return;

      row.games += 1;

      if (isWinnerResult(result)) {
        row.wins += 1;
      }
    });
  });

  return Array.from(stats.values())
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .slice(0, 6);
}

function getPlayerName(player: any) {
  return String(
    player.name ?? player.Nom ?? player.nom ?? player.playerName ?? ""
  ).trim();
}

function getResultName(result: any) {
  return String(
    result.playerName ??
      result.JoueurNom ??
      result.joueurNom ??
      result.name ??
      result.player ??
      result.nom ??
      result.Nom ??
      ""
  ).trim();
}

function isWinnerResult(result: any) {
  const position = toNumber(
    result.position ?? result.Position ?? result.rank ?? result.Rang
  );

  return (
    result.isWinner === true ||
    result.winner === true ||
    result.win === true ||
    result.victoire === true ||
    position === 1
  );
}

function getGameSeason(game: any) {
  const explicitSeason = game.season ?? game.saison;
  if (explicitSeason) return String(explicitSeason);

  const timestamp = getGameDateValue(game);
  if (timestamp === null) return null;

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (year < 2026 || (year === 2026 && month < 4)) return "S00";

  const monthsSinceApril2026 = (year - 2026) * 12 + (month - 4);
  const seasonIndex = Math.floor(monthsSinceApril2026 / 3) + 1;

  return `S${String(seasonIndex).padStart(2, "0")}`;
}

function getGameDateValue(game: any) {
  if (game.dateTimestamp) {
    const timestamp = Number(game.dateTimestamp);
    return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  }

  const rawDate = game.date ?? game.DatePartie ?? game.datePartie;
  if (!rawDate) return null;

  if (rawDate instanceof Date) {
    const timestamp = rawDate.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof rawDate === "number") {
    if (rawDate > 30_000 && rawDate < 80_000) {
      return excelSerialDateToTimestamp(rawDate);
    }

    return rawDate < 1_000_000_000_000 ? rawDate * 1000 : rawDate;
  }

  const value = String(rawDate);

  if (value.includes("-")) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day).getTime();
}

function excelSerialDateToTimestamp(serial: number) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86_400_000;
  const date = new Date(utcValue);

  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ).getTime();
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatLastActivity(timestamp: number | null) {
  if (!timestamp) return "—";

  const today = startOfDay(new Date()).getTime();
  const date = startOfDay(new Date(timestamp)).getTime();
  const diffDays = Math.floor((today - date) / 86_400_000);

  if (diffDays <= 0) return "Aujourd’hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 31) return `Il y a ${Math.floor(diffDays / 7)} semaines`;

  return `Il y a ${diffDays} jours`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(";")
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}