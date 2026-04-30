"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UseAuthRedirectOptions = {
  requireAuth?: boolean;
  redirectIfAuthenticated?: boolean;
};

export function useAuthRedirect({
  requireAuth = false,
  redirectIfAuthenticated = false,
}: UseAuthRedirectOptions) {
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (requireAuth && !session) {
        window.location.href = "/login";
        return;
      }

      if (redirectIfAuthenticated && session) {
        window.location.href = "/dashboard";
        return;
      }

      setCheckingAuth(false);
    };

    checkSession();
  }, [requireAuth, redirectIfAuthenticated]);

  return { checkingAuth };
}