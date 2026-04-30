export function getAuthErrorMessage(error: any): string {
  const msg = error?.message?.toLowerCase() || "";

  if (msg.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }

  if (msg.includes("email not confirmed")) {
    return "Ton email n’est pas encore confirmé.";
  }

  if (msg.includes("user not found")) {
    return "Aucun compte trouvé avec cet email.";
  }

  if (msg.includes("already registered")) {
    return "Un compte existe déjà avec cet email.";
  }

  if (msg.includes("password")) {
    return "Mot de passe invalide.";
  }

  return "Une erreur est survenue. Réessaie plus tard.";
}