import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LoginClient from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/captions");
  }

  return (
    <main className="page">
      <div className="container">
        <section className="loginLayout stagger">
          <div className="loginHero">
            <span className="badge badgePremium">Member Access</span>
            <h1 className="loginTitle">
              Step into the
              <span className="loginTitleAccent">caption lounge</span>
            </h1>
            <p className="loginSubtitle">
              Sign in to reach the captions feed.
            </p>
          </div>

          <div className="loginPanel">
            <div className="loginPanelHeader">
              <h2 className="sectionTitle">Continue with Google</h2>
              <p className="subtitle">
                You will be redirected to Google and returned to your feed.
              </p>
            </div>
            <LoginClient />
          </div>
        </section>
      </div>
    </main>
  );
}
