"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  LayoutDashboard,
  Loader2,
  Mail,
  Monitor,
  Moon,
  Palette,
  Save,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";

type AppearanceMode = "dark" | "light" | "system";
type InterfaceDensity = "compact" | "comfortable" | "spacious";

type ProfileSettings = {
  user_id: string;
  email: string | null;
  role: string | null;
  notify_new_games: boolean;
  appearance_mode: AppearanceMode;
  interface_density: InterfaceDensity;
  enable_animations: boolean;
};

const APPEARANCE_OPTIONS: {
  value: AppearanceMode;
  label: string;
  description: string;
  icon: typeof Moon;
}[] = [
  {
    value: "dark",
    label: "Sombre",
    description: "Interface premium sombre par défaut.",
    icon: Moon,
  },
  {
    value: "light",
    label: "Clair",
    description: "Interface lumineuse pour usage journée.",
    icon: Sun,
  },
  {
    value: "system",
    label: "Système",
    description: "Suit le thème de ton appareil.",
    icon: Monitor,
  },
];

const DENSITY_OPTIONS: {
  value: InterfaceDensity;
  label: string;
  description: string;
}[] = [
  {
    value: "compact",
    label: "Compact",
    description: "Plus de données visibles à l’écran.",
  },
  {
    value: "comfortable",
    label: "Confort",
    description: "Équilibre idéal pour l’usage quotidien.",
  },
  {
    value: "spacious",
    label: "Spacieux",
    description: "Affichage plus aéré et premium.",
  },
];

export default function SettingsPage() {
  const { checkingAuth } = useAuthRedirect({ requireAuth: true });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileSettings | null>(null);

  const [notifyNewGames, setNotifyNewGames] = useState(true);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("dark");
  const [interfaceDensity, setInterfaceDensity] =
    useState<InterfaceDensity>("comfortable");
  const [enableAnimations, setEnableAnimations] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasChanges =
    profile !== null &&
    (profile.notify_new_games !== notifyNewGames ||
      profile.appearance_mode !== appearanceMode ||
      profile.interface_density !== interfaceDensity ||
      profile.enable_animations !== enableAnimations);

  useEffect(() => {
    if (checkingAuth) return;

    async function loadSettings() {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setError("Utilisateur non connecté.");
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select(
            `
            user_id,
            email,
            role,
            notify_new_games,
            appearance_mode,
            interface_density,
            enable_animations
          `
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("Erreur chargement paramètres :", {
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            code: profileError.code,
          });

          setError(`Impossible de charger les paramètres : ${profileError.message}`);
          return;
        }

        if (!data) {
          setError(
            "Profil introuvable dans la table profiles. Il faut créer la ligne profile côté inscription/admin avant de pouvoir sauvegarder les paramètres."
          );

          const fallbackProfile = buildDefaultProfile(user.id, user.email ?? null);
          setProfile(fallbackProfile);
          setNotifyNewGames(fallbackProfile.notify_new_games);
          setAppearanceMode(fallbackProfile.appearance_mode);
          setInterfaceDensity(fallbackProfile.interface_density);
          setEnableAnimations(fallbackProfile.enable_animations);
          return;
        }

        const loadedProfile: ProfileSettings = {
          user_id: data.user_id,
          email: data.email ?? user.email ?? null,
          role: data.role ?? "membre",
          notify_new_games:
            typeof data.notify_new_games === "boolean"
              ? data.notify_new_games
              : true,
          appearance_mode: isAppearanceMode(data.appearance_mode)
            ? data.appearance_mode
            : "dark",
          interface_density: isInterfaceDensity(data.interface_density)
            ? data.interface_density
            : "comfortable",
          enable_animations:
            typeof data.enable_animations === "boolean"
              ? data.enable_animations
              : true,
        };

        setProfile(loadedProfile);
        setNotifyNewGames(loadedProfile.notify_new_games);
        setAppearanceMode(loadedProfile.appearance_mode);
        setInterfaceDensity(loadedProfile.interface_density);
        setEnableAnimations(loadedProfile.enable_animations);
      } catch (unexpectedError) {
        console.warn("Erreur inattendue settings :", unexpectedError);
        setError("Une erreur inattendue est survenue.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [checkingAuth]);

  async function handleSave() {
    if (!profile) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const { data: updatedProfile, error: saveError } = await supabase
        .from("profiles")
        .update({
          notify_new_games: notifyNewGames,
          appearance_mode: appearanceMode,
          interface_density: interfaceDensity,
          enable_animations: enableAnimations,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", profile.user_id)
        .select(
          `
          user_id,
          email,
          role,
          notify_new_games,
          appearance_mode,
          interface_density,
          enable_animations
        `
        )
        .maybeSingle();

      if (saveError) {
        console.warn("Erreur sauvegarde paramètres :", {
          message: saveError.message,
          details: saveError.details,
          hint: saveError.hint,
          code: saveError.code,
        });

        setError(`Impossible d’enregistrer les paramètres : ${saveError.message}`);
        return;
      }

      if (!updatedProfile) {
        setError(
          "Aucune ligne profile n’a été mise à jour. Vérifie que ton user_id existe dans la table profiles."
        );
        return;
      }

      const nextProfile: ProfileSettings = {
        user_id: updatedProfile.user_id,
        email: updatedProfile.email ?? profile.email,
        role: updatedProfile.role ?? profile.role ?? "membre",
        notify_new_games:
          typeof updatedProfile.notify_new_games === "boolean"
            ? updatedProfile.notify_new_games
            : notifyNewGames,
        appearance_mode: isAppearanceMode(updatedProfile.appearance_mode)
          ? updatedProfile.appearance_mode
          : appearanceMode,
        interface_density: isInterfaceDensity(updatedProfile.interface_density)
          ? updatedProfile.interface_density
          : interfaceDensity,
        enable_animations:
          typeof updatedProfile.enable_animations === "boolean"
            ? updatedProfile.enable_animations
            : enableAnimations,
      };

      setProfile(nextProfile);
      setNotifyNewGames(nextProfile.notify_new_games);
      setAppearanceMode(nextProfile.appearance_mode);
      setInterfaceDensity(nextProfile.interface_density);
      setEnableAnimations(nextProfile.enable_animations);

      setSuccess("Paramètres enregistrés avec succès.");
    } catch (unexpectedError) {
      console.warn("Erreur inattendue sauvegarde settings :", unexpectedError);
      setError("Une erreur inattendue est survenue pendant la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!profile) return;

    setNotifyNewGames(profile.notify_new_games);
    setAppearanceMode(profile.appearance_mode);
    setInterfaceDensity(profile.interface_density);
    setEnableAnimations(profile.enable_animations);
    setError("");
    setSuccess("");
  }

  if (checkingAuth || loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">
          Chargement des paramètres...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-cyan-500/[0.08] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
          <div className="absolute right-[-80px] top-[-80px] h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
                <Settings className="h-4 w-4" />
                Paramètres
              </p>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Préférences utilisateur
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Personnalise ton expérience Skyjo Seenovate : notifications,
                thème, confort d’affichage et animations.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Compte
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {profile?.email || "Utilisateur"}
              </p>
              <p className="mt-1 text-xs text-cyan-200">
                {profile?.role || "membre"}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <SettingsPanel
              icon={Bell}
              eyebrow="Notifications"
              title="Alertes email"
              description="Choisis les événements Skyjo pour lesquels tu souhaites être notifié."
            >
              <ToggleRow
                icon={Mail}
                title="Nouvelle partie ajoutée"
                description="Recevoir un email lorsqu’un administrateur ajoute une nouvelle partie."
                enabled={notifyNewGames}
                onChange={setNotifyNewGames}
              />
            </SettingsPanel>

            <SettingsPanel
              icon={Palette}
              eyebrow="Apparence"
              title="Mode d’affichage"
              description="Définis le rendu visuel principal de l’application."
            >
              <div className="grid gap-3 md:grid-cols-3">
                {APPEARANCE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = appearanceMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAppearanceMode(option.value)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-cyan-300/40 bg-cyan-300/10 text-white"
                          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/30 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Icon
                          className={
                            selected
                              ? "h-5 w-5 text-cyan-200"
                              : "h-5 w-5 text-slate-500"
                          }
                        />

                        {selected && (
                          <Check className="h-4 w-4 text-cyan-200" />
                        )}
                      </div>

                      <p className="mt-4 text-sm font-semibold">
                        {option.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs leading-5 text-amber-100">
                Le choix est sauvegardé. L’application du thème global dépendra
                ensuite de ton layout CSS/Tailwind.
              </div>
            </SettingsPanel>

            <SettingsPanel
              icon={LayoutDashboard}
              eyebrow="Interface"
              title="Confort d’affichage"
              description="Ajuste la densité et les effets visuels de l’interface."
            >
              <div className="grid gap-3 md:grid-cols-3">
                {DENSITY_OPTIONS.map((option) => {
                  const selected = interfaceDensity === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setInterfaceDensity(option.value)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-cyan-300/40 bg-cyan-300/10 text-white"
                          : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-300/30 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{option.label}</p>
                        {selected && (
                          <Check className="h-4 w-4 text-cyan-200" />
                        )}
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5">
                <ToggleRow
                  icon={Sparkles}
                  title="Animations premium"
                  description="Activer les transitions, effets hover et micro-animations."
                  enabled={enableAnimations}
                  onChange={setEnableAnimations}
                />
              </div>
            </SettingsPanel>
          </div>

          <aside className="h-fit rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Résumé
            </p>

            <h2 className="mt-3 text-xl font-semibold text-white">
              Configuration actuelle
            </h2>

            <div className="mt-6 space-y-3">
              <SummaryRow
                label="Emails parties"
                value={notifyNewGames ? "Activés" : "Désactivés"}
                active={notifyNewGames}
              />
              <SummaryRow
                label="Thème"
                value={getAppearanceLabel(appearanceMode)}
                active
              />
              <SummaryRow
                label="Densité"
                value={getDensityLabel(interfaceDensity)}
                active
              />
              <SummaryRow
                label="Animations"
                value={enableAnimations ? "Activées" : "Désactivées"}
                active={enableAnimations}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                disabled={!hasChanges || saving || !profile}
                onClick={handleSave}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={!hasChanges || saving || !profile}
                onClick={handleReset}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuler les modifications
              </button>
            </div>

            {hasChanges && (
              <p className="mt-4 text-xs leading-5 text-amber-200">
                Tu as des changements non enregistrés.
              </p>
            )}
          </aside>
        </section>
      </main>
    </AppShell>
  );
}

function buildDefaultProfile(
  userId: string,
  email: string | null
): ProfileSettings {
  return {
    user_id: userId,
    email,
    role: email?.includes("+admin@") ? "admin" : "membre",
    notify_new_games: true,
    appearance_mode: "dark",
    interface_density: "comfortable",
    enable_animations: true,
  };
}

function SettingsPanel({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: typeof Settings;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-2xl">
      <div className="mb-6 flex items-start gap-4">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3">
          <Icon className="h-5 w-5 text-cyan-200" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function ToggleRow({
  icon: Icon,
  title,
  description,
  enabled,
  onChange,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-4">
        <div className="h-fit rounded-2xl border border-white/10 bg-black/20 p-3">
          <Icon className="h-5 w-5 text-slate-300" />
        </div>

        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative h-10 w-20 shrink-0 cursor-pointer rounded-full border transition ${
          enabled
            ? "border-cyan-300/40 bg-cyan-300/20"
            : "border-white/10 bg-white/[0.05]"
        }`}
      >
        <span
          className={`absolute top-1 h-8 w-8 rounded-full transition ${
            enabled ? "left-11 bg-cyan-300" : "left-1 bg-slate-500"
          }`}
        />
        <span className="sr-only">{enabled ? "Désactiver" : "Activer"}</span>
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span
        className={active ? "text-sm text-cyan-200" : "text-sm text-slate-500"}
      >
        {value}
      </span>
    </div>
  );
}

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "dark" || value === "light" || value === "system";
}

function isInterfaceDensity(value: unknown): value is InterfaceDensity {
  return value === "compact" || value === "comfortable" || value === "spacious";
}

function getAppearanceLabel(value: AppearanceMode) {
  if (value === "dark") return "Sombre";
  if (value === "light") return "Clair";
  return "Système";
}

function getDensityLabel(value: InterfaceDensity) {
  if (value === "compact") return "Compact";
  if (value === "spacious") return "Spacieux";
  return "Confort";
}