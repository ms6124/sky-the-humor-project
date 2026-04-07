import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SwipeClient, { type SwipeCard } from "./swipe-client";
import ThemeToggle from "@/app/theme-toggle";

export const dynamic = "force-dynamic";

export default async function SwipePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const recentFetchLimit = 120;

  const { data: votedCaptions } = await supabase
    .from("caption_votes")
    .select("caption_id, captions!inner(created_datetime_utc)")
    .eq("profile_id", user.id)
    .gte("captions.created_datetime_utc", cutoff);

  const votedIds = new Set(
    votedCaptions?.map((row) => row.caption_id).filter(Boolean) ?? []
  );

  const { data: recentCaptions, error } = await supabase
    .from("captions")
    .select(
      "id, content, like_count, created_datetime_utc, images!inner (url, image_description, is_public)"
    )
    .eq("images.is_public", true)
    .not("images.url", "is", null)
    .gte("created_datetime_utc", cutoff)
    .order("created_datetime_utc", { ascending: false })
    .limit(recentFetchLimit);

  if (error) {
    return (
      <main className="page">
        <div className="container">
          <section className="card">
            <h1 className="sectionTitle">Swipe mode unavailable</h1>
            <p className="subtitle">{error.message}</p>
            <div className="actions">
              <Link className="button buttonSecondary" href="/captions">
                Scroll mode
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const cards: SwipeCard[] =
    recentCaptions
      ?.filter((row) => Boolean(row.id) && !votedIds.has(row.id as string))
      .slice(0, 50)
      .map((row) => {
        const image = Array.isArray(row.images) ? row.images[0] : row.images;
        const createdLabel = row.created_datetime_utc
          ? new Date(row.created_datetime_utc).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Recently";
        return {
          id: row.id as string,
          content: row.content ?? "Untitled caption",
          likeCount: row.like_count ?? 0,
          createdLabel,
          imageUrl: image?.url ?? null,
          imageDescription: image?.image_description ?? null,
          voteId: null,
          voteValue: null,
        };
      }) ?? [];

  return (
    <main className="page swipeShell">
      <div className="container">
        <header className="pageHeader">
          <div className="header">
            <span className="badge badgePremium">Swipe Mode</span>
            <h1 className="title">Flick through fresh captions</h1>
            <p className="subtitle">
              Quick reactions, zero scrolling. Swipe right for like, left for pass.
            </p>
          </div>
          <div className="memberPanel">
            <div className="memberTop">
              <div className="memberInfo">
                <span className="memberLabel">Signed in</span>
                <span className="memberValue">{user.email ?? "Unknown"}</span>
              </div>
              <ThemeToggle />
            </div>
            <div className="memberActions">
              <Link className="button buttonSecondary" href="/captions">
                Scroll mode
              </Link>
            </div>
          </div>
        </header>

        <SwipeClient cards={cards} userId={user.id} />
      </div>
    </main>
  );
}
