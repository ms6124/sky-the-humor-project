import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const MAX_BATCH = 50;
const MAX_EXCLUDES = 500;
const RECENT_FETCH_LIMIT = 120;

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const excludeIds = Array.isArray(body?.excludeIds)
    ? body.excludeIds.filter((id: unknown) => typeof id === "string")
    : [];

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: votedCaptions } = await supabase
    .from("caption_votes")
    .select("caption_id, captions!inner(created_datetime_utc)")
    .eq("profile_id", user.id)
    .gte("captions.created_datetime_utc", cutoff);

  const votedIds = new Set(
    votedCaptions?.map((row) => row.caption_id).filter(Boolean) ?? []
  );
  const excludeSet = new Set(excludeIds.slice(0, MAX_EXCLUDES));

  const { data, error } = await supabase
    .from("captions")
    .select(
      "id, content, like_count, created_datetime_utc, images!inner (url, image_description, is_public)"
    )
    .eq("images.is_public", true)
    .not("images.url", "is", null)
    .gte("created_datetime_utc", cutoff)
    .order("created_datetime_utc", { ascending: false })
    .limit(RECENT_FETCH_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cards =
    data
      ?.filter(
        (row) =>
          Boolean(row.id) &&
          !votedIds.has(row.id as string) &&
          !excludeSet.has(row.id as string)
      )
      .slice(0, MAX_BATCH)
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

  return NextResponse.json({ cards });
}
