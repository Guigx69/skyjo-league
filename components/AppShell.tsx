"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Swords,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leaderboard", label: "Classement", icon: Trophy },
  { href: "/players", label: "Joueurs", icon: Users },
  { href: "/games", label: "Parties", icon: Gamepad2 },
  { href: "/rivalries", label: "Rivalités", icon: Swords },
  { href: "/adversity", label: "Adversité", icon: BarChart3 },
  { href: "/seasons", label: "Saisons", icon: CalendarDays },
];

const adminNavItems = [
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/players/new", label: "Ajouter un joueur", icon: UserPlus },
  { href: "/games/new", label: "Ajouter une partie", icon: Gamepad2 },
];

export default function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string;
}) {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [resolvedUserEmail, setResolvedUserEmail] = useState(userEmail);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      setResolvedUserEmail(userEmail ?? data.user?.email ?? "Utilisateur");

      const { data: adminResult, error } = await supabase.rpc(
        "is_current_user_admin"
      );

      if (error) {
        console.error("Erreur vérification admin :", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(adminResult === true);
    }

    loadUser();
  }, [userEmail]);

  const displayUser = resolvedUserEmail ?? "Utilisateur";

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function NavLink({
    href,
    label,
    icon: Icon,
    compact = false,
    onNavigate,
  }: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    compact?: boolean;
    onNavigate?: () => void;
  }) {
    const active = pathname === href || pathname.startsWith(`${href}/`);

    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={`
          group relative flex items-center gap-3 rounded-xl px-4
          ${compact ? "py-1.5 text-[12px]" : "py-1.5 text-[14px]"}
          overflow-hidden transition-all duration-300 ease-out
          ${
            active
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_22px_rgba(56,189,248,0.22)]"
              : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          }
        `}
      >
        <span
          className={`
            absolute inset-y-1 left-1 w-1 rounded-full transition-all duration-300
            ${
              active
                ? "bg-white/80 opacity-100"
                : "bg-cyan-300/60 opacity-0 group-hover:opacity-100"
            }
          `}
        />

        <Icon
          size={compact ? 14 : 16}
          className={`
            shrink-0 transition-all duration-300
            ${
              active
                ? "text-white"
                : "text-zinc-500 group-hover:scale-110 group-hover:text-cyan-200"
            }
          `}
        />

        <span className="truncate transition-transform duration-300 group-hover:translate-x-0.5">
          {label}
        </span>
      </Link>
    );
  }

  function Navigation({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="space-y-3">
        <div className="space-y-[2px]">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {isAdmin && (
          <div className="border-t border-white/10 pt-3">
            <p className="mb-2 px-4 text-[8px] font-semibold uppercase tracking-[0.4em] text-blue-300/60">
              Administration
            </p>

            <div className="space-y-[2px]">
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  compact
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        )}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#020617]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-xl border border-white/10 bg-white/[0.04] p-2 transition hover:bg-white/[0.08] active:scale-95"
          aria-label="Ouvrir le menu"
        >
          <Menu size={18} />
        </button>

        <p className="font-semibold">Ligue Skyjo</p>

        <Link
          href="/settings"
          className="rounded-xl border border-white/10 bg-white/[0.04] p-2 transition hover:bg-cyan-300/10 hover:text-cyan-200 active:scale-95"
          aria-label="Paramètres"
        >
          <Settings size={18} />
        </Link>
      </header>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col
          border-r border-white/10 bg-[#020617] px-5 py-5
          transition-transform duration-300 ease-out
          ${
            mobileOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition duration-300 hover:border-cyan-300/30 hover:bg-cyan-300/10">
              <img src="/S_BLANC.png" alt="Seenovate" className="h-7" />
            </div>

            <h1 className="text-[18px] font-bold tracking-tight">
              Ligue Skyjo
            </h1>
          </div>

          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 transition hover:bg-white/[0.08] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex-1">
          <Navigation onNavigate={() => setMobileOpen(false)} />
        </div>

        <div className="shrink-0 border-t border-white/10 pt-3">
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3 transition duration-300 hover:border-emerald-300/25 hover:bg-emerald-400/[0.07]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
              <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
              Connecté
            </p>

            <p className="mt-2 truncate text-[13px] font-medium">
              {displayUser}
            </p>

            <p className="mt-1 text-[11px] text-zinc-400">
              {isAdmin ? "Administrateur" : "Membre"}
            </p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* PARAMÈTRES */}
            <Link
              href="/settings"
              className="
                group
                relative
                overflow-hidden
                flex h-11
                items-center justify-center gap-2
                rounded-xl
                border border-white/10
                bg-white/[0.03]
                text-xs
                transition-all duration-500
                hover:border-cyan-300/30
                hover:shadow-[0_0_25px_rgba(34,211,238,0.18)]
                active:scale-[0.97]
              "
            >
              <span
                className="
                  absolute
                  inset-0
                  -translate-x-full
                  bg-gradient-to-r
                  from-transparent
                  via-cyan-300/15
                  to-transparent
                  transition-transform
                  duration-1000
                  group-hover:translate-x-full
                "
              />
              <Settings
                size={15}
                className="
                  relative z-10
                  transition-all duration-700
                  group-hover:rotate-[180deg]
                  group-hover:scale-125
                "
              />
              <span
                className="
                  relative z-10
                  transition-all duration-300
                  group-hover:text-cyan-200
                "
              >
                Paramètres
              </span>
            </Link>
            {/* DÉCONNEXION */}
            <button
              type="button"
              onClick={handleLogout}
              className="
                group
                relative
                overflow-hidden
                flex h-11
                cursor-pointer
                items-center justify-center gap-2
                rounded-xl
                border border-red-500/20
                bg-red-500/10
                text-xs text-red-200
                transition-all duration-500
                hover:border-red-400/40
                hover:shadow-[0_0_25px_rgba(239,68,68,0.22)]
                active:scale-[0.97]
              "
            >
              <span
                className="
                  absolute
                  inset-0
                  translate-y-full
                  bg-red-500/15
                  transition-transform duration-500
                  group-hover:translate-y-0
                "
              />
              <LogOut
                size={15}
                className="
                  relative z-10
                  transition-all duration-500
                  group-hover:translate-x-1
                  group-hover:scale-125
                "
              />
              <span
                className="
                  relative z-10
                  transition-all duration-300
                  group-hover:text-white
                "
              >
                Déconnexion
              </span>
            </button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen px-6 py-8 lg:ml-[280px]">
        {children}
      </main>
    </div>
  );
}