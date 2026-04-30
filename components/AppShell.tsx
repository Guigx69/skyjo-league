"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Classement" },
  { href: "/players", label: "Joueurs" },
  { href: "/games", label: "Parties" },
  { href: "/rivalries", label: "Rivalités" },
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/10 bg-[#020617]/95 p-6 shadow-[20px_0_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:block">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/70">
            Seenovate
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Skyjo League
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Dashboard interne
          </p>
        </div>

        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
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

        <div className="absolute bottom-6 left-6 right-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-zinc-500">Connecté en tant que</p>
            <p className="mt-1 truncate text-sm text-zinc-300">
              {userEmail ?? "Utilisateur Seenovate"}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white hover:text-slate-950"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="min-h-screen px-6 py-8 lg:ml-72 lg:px-10">
        {children}
      </main>
    </div>
  );
}