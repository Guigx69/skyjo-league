"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/players", label: "Joueurs" },
  { href: "/games", label: "Parties" },
  { href: "/rivalries", label: "Rivalités" },
  { href: "/adversity", label: "Adversité" },
  { href: "/seasons", label: "Saisons" },
  { href: "/admin", label: "Admin" },
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

  useEffect(() => {
    if (userEmail) {
      setResolvedUserEmail(userEmail);
      return;
    }

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setResolvedUserEmail(data.user?.email ?? "Utilisateur Seenovate");
    };

    loadUser();
  }, [userEmail]);

  const displayUser = resolvedUserEmail ?? "Utilisateur Seenovate";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const UserBlock = () => (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs text-zinc-500">Connecté en tant que</p>
        <p className="mt-1 truncate text-sm text-zinc-300">{displayUser}</p>
      </div>

      <button
        onClick={handleLogout}
        className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
      >
        Se déconnecter
      </button>
    </>
  );

  const Navigation = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="mt-10 space-y-2">
      {navItems.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${
              active
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white">
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
          <p className="text-xs uppercase tracking-[0.25em] text-blue-300/70">
            Seenovate
          </p>
          <p className="text-sm font-semibold">Skyjo League</p>
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
        className={`fixed left-0 top-0 z-50 h-screen w-80 max-w-[86vw] border-r border-white/10 bg-[#020617]/98 p-6 shadow-[20px_0_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/70">
              Seenovate
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Skyjo League
            </h1>
            <p className="mt-2 text-sm text-zinc-500">Dashboard interne</p>
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

        <Navigation onNavigate={() => setMobileOpen(false)} />

        <div className="absolute bottom-6 left-6 right-6">
          <UserBlock />
        </div>
      </aside>

      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/10 bg-[#020617]/95 p-6 shadow-[20px_0_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:block">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/70">
            Seenovate
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Skyjo League
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Dashboard interne</p>
        </div>

        <Navigation />

        <div className="absolute bottom-6 left-6 right-6">
          <UserBlock />
        </div>
      </aside>

      <main className="min-h-screen px-6 py-8 lg:ml-72 lg:px-10">
        {children}
      </main>
    </div>
  );
}