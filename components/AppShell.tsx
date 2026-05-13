"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/players", label: "Joueurs" },
  { href: "/games", label: "Parties" },
  { href: "/rivalries", label: "Rivalités" },
  { href: "/adversity", label: "Adversité" },
  { href: "/seasons", label: "Saisons" },
];

const adminNavItems = [
  { href: "/admin", label: "Admin" },
  { href: "/admin/players/new", label: "Ajouter un joueur" },
  { href: "/games/new", label: "Ajouter une partie" },
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
    const loadUser = async () => {
      if (userEmail) {
        setResolvedUserEmail(userEmail);
      } else {
        const { data } = await supabase.auth.getUser();
        setResolvedUserEmail(data.user?.email ?? "Utilisateur Seenovate");
      }

      const { data: adminResult, error } = await supabase.rpc(
        "is_current_user_admin"
      );

      if (error) {
        console.error("Erreur vérification admin :", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(adminResult === true);
    };

    loadUser();
  }, [userEmail]);

  const displayUser = resolvedUserEmail ?? "Utilisateur Seenovate";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const UserBlock = () => (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
        <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">
          Connecté
        </p>

        <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-300">
          {displayUser}
        </p>
      </div>

      <button
        onClick={handleLogout}
        className="group flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-200 transition hover:border-red-300/40 hover:bg-red-500/20 hover:text-red-100"
        aria-label="Se déconnecter"
      >
        <LogOut size={17} className="transition group-hover:translate-x-0.5" />
      </button>
    </div>
  );

  const NavLink = ({
    href,
    label,
    onNavigate,
    compact = false,
  }: {
    href: string;
    label: string;
    onNavigate?: () => void;
    compact?: boolean;
  }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);

    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={`block rounded-2xl px-4 font-medium transition ${
          compact ? "py-1.5 text-sm" : "py-2 text-sm"
        } ${
          active
            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
            : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        {label}
      </Link>
    );
  };

  const Navigation = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-4">
      <div className="space-y-1">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {isAdmin && (
        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-300/60">
            Administration
          </p>

          <div className="space-y-1">
            {adminNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                onNavigate={onNavigate}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-[#020617] text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#020617]/90 px-4 py-4 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-white transition hover:bg-white/[0.08]"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold">Ligue Skyjo</p>
        </div>

        <div className="h-10 w-10" />
      </header>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-80 max-w-[86vw] flex-col border-r border-white/10 bg-[#020617]/98 px-5 py-4 shadow-[20px_0_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight">
              Ligue Skyjo
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
          <Navigation onNavigate={() => setMobileOpen(false)} />
        </div>

        <div className="shrink-0 border-t border-white/10 pt-3">
          <UserBlock />
        </div>
      </aside>

      <aside className="fixed left-0 top-0 hidden h-screen w-72 flex-col border-r border-white/10 bg-[#020617]/95 px-5 py-4 shadow-[20px_0_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-4">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] shadow-[0_14px_50px_rgba(59,130,246,0.16)]">
            <img
              src="/S_BLANC.png"
              alt="Seenovate"
              className="h-11 w-11 object-contain"
            />
          </div>

          <div>
            <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight">
              Ligue Skyjo
            </h1>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
          <Navigation />
        </div>

        <div className="shrink-0 border-t border-white/10 pt-3">
          <UserBlock />
        </div>
      </aside>

      <main className="min-h-screen w-full overflow-x-clip px-6 py-8 lg:ml-72 lg:w-[calc(100%-18rem)] lg:px-10">
        {children}
      </main>
    </div>
  );
}