import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ThemeToggle from "@/app/theme-toggle";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("captions")
    .select(
      "id, content, like_count, is_featured, created_datetime_utc, images!inner (id, url, image_description, is_public)"
    )
    .eq("is_public", true)
    .eq("images.is_public", true)
    .not("images.url", "is", null)
    .order("created_datetime_utc", { ascending: false })
    .limit(30);

  type CaptionRow = NonNullable<typeof data>[number];
  const seenImages = new Set<string>();
  const highlights: CaptionRow[] = [];

  for (const row of data ?? []) {
    const image = Array.isArray(row.images) ? row.images[0] : row.images;
    const imageKey = image?.id ?? image?.url;
    if (!imageKey || seenImages.has(imageKey)) {
      continue;
    }
    seenImages.add(imageKey);
    highlights.push(row);
    if (highlights.length >= 6) {
      break;
    }
  }

  return (
    <main className="page">
      <div className="container">
        <div className="header revealOnLoad">
          <div className="headerTop">
            <span className="badge">Captions</span>
            <ThemeToggle />
          </div>
          <h1 className="title">A focused home for your caption feed</h1>
          <p className="subtitle">
            Browse public picks now, then sign in to unlock the full captions feed
            with filters and member-only highlights.
          </p>
          <div className="actions">
            <Link className="button" href="/login">
              Sign in for the full feed
            </Link>
          </div>
        </div>

        <section className="sectionSpacing">
          <div className="sectionHeader">
            <h2 className="sectionTitle">Public highlights</h2>
          </div>
          {highlights.length > 0 ? (
            <section className="captionGrid stagger">
              {highlights.map((row, index) => {
                const image = Array.isArray(row.images) ? row.images[0] : row.images;
                const likeCount = row.like_count ?? 0;
                const likeLabel = `Score: ${likeCount}`;
                const created = row.created_datetime_utc
                  ? new Date(row.created_datetime_utc).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "Recently";

                return (
                  <article className="captionCard" key={row.id ?? index}>
                    <div className="captionHeader">
                      <span className="captionIndex">Highlight {index + 1}</span>
                      {row.is_featured ? (
                        <span className="captionBadge">Featured</span>
                      ) : null}
                    </div>
                    <p className="captionText">{row.content || "Untitled caption"}</p>
                    {image?.url ? (
                      <div className="captionImageFrame">
                        <img
                          className="captionImage"
                          src={image.url}
                          alt={image.image_description || "Caption image"}
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    <div className="captionMeta">
                      <span>{created}</span>
                      <span>{likeLabel}</span>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <div className="empty">No public captions yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}
