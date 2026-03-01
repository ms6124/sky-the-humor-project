"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function CaptionsClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="memberActions">
      <Link className="button buttonSecondary" href="/swipe">
        Swipe mode
      </Link>
      <button className="button buttonGhost" onClick={handleSignOut} disabled={isLoading}>
        {isLoading ? "Signing out..." : "Sign out"}
      </button>
      {errorMessage ? <span className="formError">{errorMessage}</span> : null}
    </div>
  );
}
