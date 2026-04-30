"use client";

import { useMemo, useState } from "react";

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStrength?: boolean;
};

function getPasswordRules(password: string) {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

function getPasswordScore(password: string) {
  const rules = getPasswordRules(password);
  return Object.values(rules).filter(Boolean).length;
}

export function isPasswordStrong(password: string) {
  const rules = getPasswordRules(password);

  return (
    rules.minLength &&
    rules.hasUppercase &&
    rules.hasLowercase &&
    rules.hasNumber &&
    rules.hasSpecial
  );
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = "Mot de passe",
  showStrength = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const rules = useMemo(() => getPasswordRules(value), [value]);
  const score = useMemo(() => getPasswordScore(value), [value]);

  const strengthLabel =
    score <= 2 ? "Faible" : score <= 4 ? "Correct" : "Fort";

  const strengthClass =
    score <= 2
      ? "bg-red-500"
      : score <= 4
        ? "bg-amber-500"
        : "bg-emerald-500";

  const strengthWidth =
    score <= 1
      ? "w-1/5"
      : score === 2
        ? "w-2/5"
        : score === 3
          ? "w-3/5"
          : score === 4
            ? "w-4/5"
            : "w-full";

  const Rule = ({ valid, label }: { valid: boolean; label: string }) => (
    <li className={`flex items-center gap-2 text-xs ${valid ? "text-emerald-300" : "text-zinc-500"}`}>
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
          valid ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-zinc-500"
        }`}
      >
        {valid ? "✓" : "·"}
      </span>
      {label}
    </li>
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 pr-24 text-sm outline-none transition focus:border-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />

        <button
        type="button"
        onClick={() => setShowPassword((current) => !current)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:text-white"
        aria-label={
            showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
        >
        {showPassword ? "Masquer" : "Afficher"}
        </button>
      </div>

      {showStrength && value.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-zinc-400">Sécurité du mot de passe</p>
            <p
              className={`text-xs font-medium ${
                score <= 2
                  ? "text-red-300"
                  : score <= 4
                    ? "text-amber-300"
                    : "text-emerald-300"
              }`}
            >
              {strengthLabel}
            </p>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${strengthClass} ${strengthWidth}`}
            />
          </div>

          <ul className="mt-4 grid gap-2">
            <Rule valid={rules.minLength} label="Au moins 8 caractères" />
            <Rule valid={rules.hasUppercase} label="Une majuscule" />
            <Rule valid={rules.hasLowercase} label="Une minuscule" />
            <Rule valid={rules.hasNumber} label="Un chiffre" />
            <Rule valid={rules.hasSpecial} label="Un caractère spécial" />
          </ul>
        </div>
      )}
    </div>
  );
}