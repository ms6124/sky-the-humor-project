import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CaptionsClient from "./captions-client";
import CaptionVoteClient from "./caption-vote-client";
import CaptionPipelineClient from "./caption-pipeline-client";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  sort?: string;
  filter?: string;
  page?: string;
};

function buildQueryString(base: SearchParams, updates: Partial<SearchParams>) {
  const params = new URLSearchParams();
  const merged = { ...base, ...updates };

  if (merged.q) params.set("q", merged.q);
  if (merged.sort) params.set("sort", merged.sort);
  if (merged.filter) params.set("filter", merged.filter);
  if (merged.page) params.set("page", merged.page);

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
  const sort =
    resolvedParams.sort === "liked"
      ? "liked"
      : resolvedParams.sort === "popular"
        ? "popular"
        : "newest";
  const pageSize = 24;
  const currentPage = Math.max(1, Number(resolvedParams.page) || 1);
  const rangeFrom = (currentPage - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const { count: likedCount } = await supabase
    .from("caption_votes")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("vote_value", 1);

  let data = null;
  let error = null;
  let count = null;

  if (sort === "liked") {
    let likedQuery = supabase
      .from("captions")
      .select(
        "id, content, like_count, is_featured, created_datetime_utc, images!inner (url, image_description, is_public), caption_votes!inner(profile_id, vote_value)",
        { count: "exact" }
      )
      .eq("caption_votes.profile_id", user.id)
      .eq("caption_votes.vote_value", 1)
      .eq("images.is_public", true)
      .not("images.url", "is", null)
      .range(rangeFrom, rangeTo);

    if (queryText) {
      likedQuery = likedQuery.ilike("content", `%${queryText}%`);
    }

    const result = await likedQuery.order("created_datetime_utc", { ascending: false });
    data = result.data;
    error = result.error;
    count = result.count;
  } else {
    let query = supabase
      .from("captions")
      .select(
        "id, content, like_count, is_featured, created_datetime_utc, images!inner (url, image_description, is_public)",
        { count: "exact" }
      )
      .eq("images.is_public", true)
      .not("images.url", "is", null)
      .range(rangeFrom, rangeTo);

    if (queryText) {
      query = query.ilike("content", `%${queryText}%`);
    }

    if (sort === "popular") {
      query = query.order("like_count", { ascending: false });
    } else {
      query = query.order("created_datetime_utc", { ascending: false });
    }

    const result = await query;
    data = result.data;
    error = result.error;
    count = result.count;
  }
  const captionIds =
    data?.map((row) => row.id).filter((id): id is string => Boolean(id)) ?? [];
  const voteMap = new Map<string, { id: number; value: number }>();
  const totalCount = count ?? data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  if (captionIds.length > 0) {
    const { data: votes } = await supabase
      .from("caption_votes")
      .select("id, caption_id, vote_value")
      .eq("profile_id", user.id)
      .in("caption_id", captionIds);

    votes?.forEach((vote) => {
      if (!vote.caption_id) return;
      voteMap.set(vote.caption_id, { id: vote.id, value: vote.vote_value });
    });
  }

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

        <CaptionPipelineClient />

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
            <button className="button buttonSecondary" type="submit">
              Search
            </button>
          </form>
          <div className="filterChips">
            <span className="chipLabel">Sort</span>
            <Link
              className={sort === "newest" ? "chip chipActive" : "chip"}
              href={`/captions${buildQueryString(
                { q: queryText, sort },
                { sort: "newest", page: "1" }
              )}`}
            >
              Newest
            </Link>
            <Link
              className={sort === "popular" ? "chip chipActive" : "chip"}
              href={`/captions${buildQueryString(
                { q: queryText, sort },
                { sort: "popular", page: "1" }
              )}`}
            >
              Most liked
            </Link>
            <Link
              className={sort === "liked" ? "chip chipActive" : "chip"}
              href={`/captions${buildQueryString(
                { q: queryText, sort },
                { sort: "liked", page: "1" }
              )}`}
            >
              My likes {likedCount ? `(${likedCount})` : ""}
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
              if (!row.id) {
                return null;
              }
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
                  <CaptionVoteClient
                    captionId={row.id}
                    userId={user.id}
                    initialVoteId={voteMap.get(row.id)?.id ?? null}
                    initialVoteValue={voteMap.get(row.id)?.value ?? null}
                    initialLikeCount={row.like_count ?? 0}
                    createdLabel={created}
                  />
                </article>
              );
            })}
          </section>
        ) : (
          <div className="empty">
            {queryText ? "No matches for your search yet." : "No captions returned yet."}
          </div>
        )}

        <section className="pagination">
          <span className="paginationMeta">
            Page {currentPage} of {totalPages}
          </span>
          <div className="paginationActions">
            {currentPage > 1 ? (
              <Link
                className="button buttonSecondary"
                href={`/captions${buildQueryString(
                  { q: queryText, sort },
                  { page: String(currentPage - 1) }
                )}`}
              >
                Previous
              </Link>
            ) : (
              <span className="button buttonSecondary" aria-disabled="true">
                Previous
              </span>
            )}
            {currentPage < totalPages ? (
              <Link
                className="button buttonSecondary"
                href={`/captions${buildQueryString(
                  { q: queryText, sort },
                  { page: String(currentPage + 1) }
                )}`}
              >
                Next
              </Link>
            ) : (
              <span className="button buttonSecondary" aria-disabled="true">
                Next
              </span>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
