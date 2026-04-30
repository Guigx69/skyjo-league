import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";

export default function HomePage() {
  return (
    <AuthLayout
      title="Compte confirmé"
      subtitle="Ton adresse email est validée. Tu peux maintenant te connecter à la ligue Skyjo Seenovate."
    >
      <div className="space-y-4">
        <Link
          href="/login"
          className="block w-full rounded-xl bg-blue-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
        >
          Aller à la connexion
        </Link>

        <Link
          href="/dashboard"
          className="block w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-medium text-zinc-200 transition hover:bg-white hover:text-slate-950"
        >
          Accéder au dashboard
        </Link>
      </div>
    </AuthLayout>
  );
}