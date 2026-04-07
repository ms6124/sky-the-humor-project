import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CaptionsClient from "../captions-client";
import CaptionPipelineClient from "../caption-pipeline-client";
import ThemeToggle from "@/app/theme-toggle";

export const dynamic = "force-dynamic";

export default async function CaptionPipelinePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="page">
      <div className="container">
        <header className="pageHeader">
          <div className="header revealOnLoad">
            <span className="badge">Caption pipeline</span>
            <h1 className="title">Upload once, get fresh captions</h1>
            <p className="subtitle">
              Add a new image and let the generator draft options for you to refine.
            </p>
          </div>
          <div className="memberPanelStack">
            <div className="memberPanel">
              <div className="memberTop">
                <div className="memberInfo">
                  <span className="memberLabel">Signed in</span>
                  <span className="memberValue">{user.email ?? "Unknown"}</span>
                </div>
                <ThemeToggle />
              </div>
              <CaptionsClient />
            </div>
            <Link className="button buttonSecondary" href="/captions">
              Back to feed
            </Link>
          </div>
        </header>

        <CaptionPipelineClient />
      </div>
    </main>
  );
}
