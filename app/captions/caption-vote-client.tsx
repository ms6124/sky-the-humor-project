"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type CaptionVoteClientProps = {
  captionId: string;
  userId: string;
  initialVoteId: number | null;
  initialVoteValue: number | null;
  initialLikeCount: number;
  createdLabel: string;
};

export default function CaptionVoteClient({
  captionId,
  userId,
  initialVoteId,
  initialVoteValue,
  initialLikeCount,
  createdLabel,
}: CaptionVoteClientProps) {
  const [currentVote, setCurrentVote] = useState<number | null>(initialVoteValue);
  const [voteId, setVoteId] = useState<number | null>(initialVoteId);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getLikeDelta = (prevVote: number | null, nextVote: number | null) => {
    const prevValue = prevVote ?? 0;
    const nextValue = nextVote ?? 0;
    return nextValue - prevValue;
  };

  const handleVote = async (value: number) => {
    if (!userId) {
      setErrorMessage("Sign in to rate captions.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();
    const timestamp = new Date().toISOString();

    const nextVote = value === currentVote ? null : value;
    const likeDelta = getLikeDelta(currentVote, nextVote);

    if (value === currentVote && voteId) {
      const { error } = await supabase.from("caption_votes").delete().eq("id", voteId);

      if (error) {
        setErrorMessage(error.message);
        setIsSaving(false);
        return;
      }

      setVoteId(null);
      setCurrentVote(null);
      if (likeDelta !== 0) {
        setLikeCount((count) => Math.max(0, count + likeDelta));
      }
      setIsSaving(false);
      return;
    }

    if (voteId) {
      const { error } = await supabase
        .from("caption_votes")
        .update({ vote_value: value, modified_datetime_utc: timestamp })
        .eq("id", voteId);

      if (error) {
        setErrorMessage(error.message);
        setIsSaving(false);
        return;
      }

      setCurrentVote(value);
      if (likeDelta !== 0) {
        setLikeCount((count) => Math.max(0, count + likeDelta));
      }
      setIsSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("caption_votes")
      .upsert(
        {
          caption_id: captionId,
          profile_id: userId,
          vote_value: value,
          created_datetime_utc: timestamp,
          modified_datetime_utc: timestamp,
        },
        { onConflict: "profile_id,caption_id" }
      )
      .select("id, vote_value")
      .single();

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    setVoteId(data?.id ?? null);
    setCurrentVote(data?.vote_value ?? value);
    if (likeDelta !== 0) {
      setLikeCount((count) => Math.max(0, count + likeDelta));
    }
    setIsSaving(false);
  };

  return (
    <>
      <div className="captionMeta">
        <span>{createdLabel}</span>
        <span>{likeCount} likes</span>
      </div>
      <div className="captionRating">
      <div className="ratingButtons" role="radiogroup" aria-label="Rate this caption">
        <button
          className={
            currentVote === 1 ? "ratingButton ratingButtonActive" : "ratingButton"
          }
          type="button"
          onClick={() => handleVote(1)}
          disabled={isSaving}
          aria-pressed={currentVote === 1}
          aria-label="Thumbs up"
        >
          👍
        </button>
        <button
          className={
            currentVote === -1 ? "ratingButton ratingButtonActive" : "ratingButton"
          }
          type="button"
          onClick={() => handleVote(-1)}
          disabled={isSaving}
          aria-pressed={currentVote === -1}
          aria-label="Thumbs down"
        >
          👎
        </button>
      </div>
      <span className="ratingStatus">
        {isSaving
          ? "Saving..."
          : currentVote === 1
            ? "You liked this caption"
            : currentVote === -1
              ? "You disliked this caption"
              : ""}
      </span>
      {errorMessage ? <span className="formError">{errorMessage}</span> : null}
      </div>
    </>
  );
}
