import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CaptionsClient from "./captions-client";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  sort?: string;
  filter?: string;
};

function buildQueryString(base: SearchParams, updates: Partial<SearchParams>) {
  const params = new URLSearchParams();
  const merged = { ...base, ...updates };

  if (merged.q) params.set("q", merged.q);
  if (merged.sort) params.set("sort", merged.sort);
  if (merged.filter) params.set("filter", merged.filter);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export default async function CaptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const queryText = (resolvedParams.q ?? "").trim();
  const sort = resolvedParams.sort === "liked" ? "liked" : "newest";
  const filter = resolvedParams.filter === "featured" ? "featured" : "all";

  let query = supabase
    .from("captions")
    .select(
      "id, content, like_count, is_featured, created_datetime_utc, images!inner (url, image_description, is_public)"
    )
    .eq("images.is_public", true)
    .not("images.url", "is", null)
    .limit(24);

  if (queryText) {
    query = query.ilike("content", `%${queryText}%`);
  }

  if (filter === "featured") {
    query = query.eq("is_featured", true);
  }

  if (sort === "liked") {
    query = query.order("like_count", { ascending: false });
  } else {
    query = query.order("created_datetime_utc", { ascending: false });
  }

  const { data, error } = await query;

  return (
    <main className="page">
      <div className="container">
        <header className="pageHeader">
          <div className="header">
            <span className="badge">Captions</span>
            <h1 className="title">The punchlines just dropped</h1>
            <p className="subtitle">
              Browse the newest picks with their original images and top reactions.
            </p>
          </div>
          <div className="memberPanel">
            <div className="memberInfo">
              <span className="memberLabel">Signed in</span>
              <span className="memberValue">{user.email ?? "Unknown"}</span>
            </div>
            <CaptionsClient />
          </div>
        </header>

        <section className="captionToolbar">
          <form className="searchBar" action="/captions" method="get">
            <input
              className="searchInput"
              type="search"
              name="q"
              placeholder="Search captions"
              defaultValue={queryText}
            />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="filter" value={filter} />
            <button className="button buttonSecondary" type="submit">
              Search
            </button>
          </form>
          <div className="filterChips">
            <span className="chipLabel">Filter</span>
            <Link
              className={filter === "all" ? "chip chipActive" : "chip"}
              href={`/captions${buildQueryString(
                { q: queryText, sort, filter },
                { filter: "all" }
              )}`}
            >
              All
            </Link>
            <Link
              className={filter === "featured" ? "chip chipActive" : "chip"}
              href={`/captions${buildQueryString(
                { q: queryText, sort, filter },
                { filter: "featured" }
              )}`}
            >
              Featured
            </Link>
          </div>
          <div className="filterChips">
            <span className="chipLabel">Sort</span>
            <Link
              className={sort === "newest" ? "chip chipActive" : "chip"}
              href={`/captions${buildQueryString(
                { q: queryText, sort, filter },
                { sort: "newest" }
              )}`}
            >
              Newest
            </Link>
            <Link
              className={sort === "liked" ? "chip chipActive" : "chip"}
              href={`/captions${buildQueryString(
                { q: queryText, sort, filter },
                { sort: "liked" }
              )}`}
            >
              Most liked
            </Link>
          </div>
        </section>

        {error ? (
          <section className="card">
            <h2 className="sectionTitle">Unable to load captions</h2>
            <p className="subtitle">
              {error.message}. Check RLS policies for <strong>captions</strong>.
            </p>
          </section>
        ) : data && data.length > 0 ? (
          <section className="captionGrid">
            {data.map((row, index) => {
              const image = Array.isArray(row.images) ? row.images[0] : row.images;
              const created = row.created_datetime_utc
                ? new Date(row.created_datetime_utc).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Recently";

              return (
                <article className="captionCard" key={row.id ?? index}>
                  <div className="captionHeader">
                    <span className="captionIndex">Caption {index + 1}</span>
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
                    <span>{row.like_count ?? 0} likes</span>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="empty">
            {queryText ? "No matches for your search yet." : "No captions returned yet."}
          </div>
        )}
      </div>
    </main>
  );
}
