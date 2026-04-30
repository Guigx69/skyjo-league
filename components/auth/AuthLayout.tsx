import type { ReactNode } from "react";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AuthLayout({
  title,
  subtitle,
  children,
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e3a8a_0%,#020617_42%,#020617_100%)] px-6 text-white">
      <div className="flex min-h-screen items-center justify-center">
        <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-300/80">
              Skyjo Seenovate
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              {title}
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {subtitle}
            </p>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}