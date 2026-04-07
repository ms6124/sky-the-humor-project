"use client";

import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type SwipeCard = {
  id: string;
  content: string;
  likeCount: number;
  createdLabel: string;
  imageUrl: string | null;
  imageDescription: string | null;
  voteId: number | null;
  voteValue: number | null;
};

type SwipeClientProps = {
  cards: SwipeCard[];
  userId: string;
};

type SwipeDirection = "like" | "nope";

const SWIPE_THRESHOLD = 120;
const EXIT_DISTANCE = 420;
const PREFETCH_OFFSET = 3;

type SwipeHistoryItem = {
  cardId: string;
  prevVoteId: number | null;
  prevVoteValue: number | null;
  prevLikeCount: number;
};

export default function SwipeClient({ cards, userId }: SwipeClientProps) {
  const [deck, setDeck] = useState<SwipeCard[]>(cards);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<SwipeHistoryItem[]>([]);
  const startRef = useRef({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTokensRef = useRef(new Map<string, number>());
  const hasHydratedRef = useRef(false);
  const storageKey = `swipeDeck:${userId}`;
  const activeCard = deck[activeIndex];
  const nextCard = deck[activeIndex + 1];

  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;

    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        userId?: string;
        deck?: SwipeCard[];
        activeIndex?: number;
      };

      if (!parsed || parsed.userId !== userId) return;
      if (!Array.isArray(parsed.deck) || parsed.deck.length === 0) return;
      if (typeof parsed.activeIndex !== "number") return;

      const safeIndex = Math.min(
        Math.max(0, parsed.activeIndex),
        parsed.deck.length
      );
      setDeck(parsed.deck);
      setActiveIndex(safeIndex);
    } catch {
      // Ignore hydration errors and fall back to server cards.
    }
  }, [storageKey, userId]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (typeof window === "undefined") return;

    const payload = JSON.stringify({
      userId,
      deck,
      activeIndex: Math.min(Math.max(0, activeIndex), deck.length),
    });
    window.localStorage.setItem(storageKey, payload);
  }, [activeIndex, deck, storageKey, userId]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (deck.length > 0) return;
    if (cards.length === 0) return;
    setDeck(cards);
    setActiveIndex(0);
  }, [cards, deck.length]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const shouldPrefetch =
      hasMore && !isLoadingMore && activeIndex >= deck.length - PREFETCH_OFFSET;

    if (!shouldPrefetch) return;

    const fetchMore = async () => {
      setIsLoadingMore(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/swipe/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            excludeIds: deck.slice(-500).map((card) => card.id),
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Unable to load more captions.");
        }

        const payload = await response.json();
        const nextCards: SwipeCard[] = Array.isArray(payload?.cards)
          ? payload.cards
          : [];
        const existingIds = new Set(deck.map((card) => card.id));
        const uniqueCards = nextCards.filter((card) => !existingIds.has(card.id));

        if (uniqueCards.length === 0) {
          setHasMore(false);
          setIsLoadingMore(false);
          return;
        }

        setDeck((prev) => [...prev, ...uniqueCards]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load more captions."
        );
      } finally {
        setIsLoadingMore(false);
      }
    };

    void fetchMore();
  }, [activeIndex, deck, hasMore, isLoadingMore]);

  const swipeLabel = useMemo(() => {
    if (!activeCard) return "";
    if (activeCard.voteValue === 1) return "You liked this earlier";
    if (activeCard.voteValue === -1) return "You passed this earlier";
    return "";
  }, [activeCard]);

  const getLikeDelta = (prevVote: number | null, nextVote: number | null) => {
    const prevValue = prevVote ?? 0;
    const nextValue = nextVote ?? 0;
    return nextValue - prevValue;
  };

  const updateCardState = (
    cardId: string,
    updates: Partial<SwipeCard> & { voteValue?: number | null }
  ) => {
    setDeck((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, ...updates } : card))
    );
  };

  const bumpToken = (cardId: string) => {
    const current = actionTokensRef.current.get(cardId) ?? 0;
    const next = current + 1;
    actionTokensRef.current.set(cardId, next);
    return next;
  };

  const isLatestToken = (cardId: string, token: number) =>
    actionTokensRef.current.get(cardId) === token;

  const persistVote = async (card: SwipeCard, value: number, token: number) => {
    if (!userId) {
      setErrorMessage("Sign in to rate captions.");
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    const supabase = createSupabaseBrowserClient();
    const timestamp = new Date().toISOString();
    const prevVote = card.voteValue ?? null;

    if (prevVote === value) {
      setStatusMessage("Already saved.");
      return;
    }

    const likeDelta = getLikeDelta(prevVote, value);

    if (card.voteId) {
      const { error } = await supabase
        .from("caption_votes")
        .update({ vote_value: value, modified_datetime_utc: timestamp })
        .eq("id", card.voteId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (isLatestToken(card.id, token)) {
        updateCardState(card.id, {
          voteValue: value,
          likeCount: Math.max(0, card.likeCount + likeDelta),
        });
      }
      return;
    }

    const { data, error } = await supabase
      .from("caption_votes")
      .upsert(
        {
          caption_id: card.id,
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
      return;
    }

    if (isLatestToken(card.id, token)) {
      updateCardState(card.id, {
        voteId: data?.id ?? null,
        voteValue: data?.vote_value ?? value,
        likeCount: Math.max(0, card.likeCount + likeDelta),
      });
    }
  };

  const advanceCard = () => {
    setActiveIndex((index) => Math.min(deck.length, index + 1));
    setDragX(0);
    setDragY(0);
    setIsDragging(false);
    setIsAnimating(false);
  };

  const triggerSwipe = (direction: SwipeDirection) => {
    if (!activeCard || isAnimating) return;
    const exitX = direction === "like" ? EXIT_DISTANCE : -EXIT_DISTANCE;

    setIsAnimating(true);
    setDragX(exitX);
    setDragY(0);

    setHistory((prev) => [
      ...prev,
      {
        cardId: activeCard.id,
        prevVoteId: activeCard.voteId ?? null,
        prevVoteValue: activeCard.voteValue ?? null,
        prevLikeCount: activeCard.likeCount,
      },
    ]);
    const token = bumpToken(activeCard.id);
    void persistVote(activeCard, direction === "like" ? 1 : -1, token);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      advanceCard();
    }, 240);
  };

  const undoLastSwipe = async () => {
    if (history.length === 0 || isAnimating) return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setActiveIndex((index) => Math.max(0, index - 1));
    setDragX(0);
    setDragY(0);
    setIsDragging(false);
    setIsAnimating(false);

    updateCardState(last.cardId, {
      voteId: last.prevVoteId,
      voteValue: last.prevVoteValue,
      likeCount: last.prevLikeCount,
    });

    if (!userId) return;

    const supabase = createSupabaseBrowserClient();
    const timestamp = new Date().toISOString();
    const token = bumpToken(last.cardId);

    if (last.prevVoteValue === null) {
      const { error } = await supabase
        .from("caption_votes")
        .delete()
        .eq("profile_id", userId)
        .eq("caption_id", last.cardId);

      if (error && isLatestToken(last.cardId, token)) {
        setErrorMessage(error.message);
      }
      return;
    }

    const { error } = await supabase
      .from("caption_votes")
      .upsert(
        {
          caption_id: last.cardId,
          profile_id: userId,
          vote_value: last.prevVoteValue,
          modified_datetime_utc: timestamp,
        },
        { onConflict: "profile_id,caption_id" }
      );

    if (error && isLatestToken(last.cardId, token)) {
      setErrorMessage(error.message);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isAnimating) return;
    setIsDragging(true);
    setStatusMessage(null);
    setErrorMessage(null);
    startRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isAnimating) return;
    setDragX(event.clientX - startRef.current.x);
    setDragY(event.clientY - startRef.current.y);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      triggerSwipe(dragX > 0 ? "like" : "nope");
      return;
    }

    setDragX(0);
    setDragY(0);
    setIsDragging(false);
  };

  if (!activeCard) {
    return (
      <section className="card swipeEmpty">
        <h2 className="sectionTitle">You are up to date</h2>
        <p className="subtitle">
          {hasMore
            ? "Loading more captions..."
            : ""}
        </p>
        <div className="actions">
          <a className="button" href="/captions">
            Scroll mode
          </a>
        </div>
      </section>
    );
  }

  const rotation = dragX / 14;
  const scale = nextCard ? 0.96 : 1;
  const activeStyle: React.CSSProperties = {
    transform: `translate(-50%, 0) translate(${dragX}px, ${dragY}px) rotate(${rotation}deg)`,
    transition: isDragging ? "none" : "transform 0.2s ease",
  };
  const nextStyle: React.CSSProperties = {
    transform: `translate(-50%, 12px) scale(${scale})`,
    transition: "transform 0.2s ease",
  };

  return (
    <section className="swipeLayout">
      <div className="swipeMeta">
        <div className="swipeMetaActions">
          <button
            className="button buttonGhost swipeMetaButton"
            type="button"
            onClick={undoLastSwipe}
            disabled={history.length === 0 || isAnimating}
          >
            Undo
          </button>
        </div>
      </div>

      <div className="swipeStack">
        {nextCard ? (
          <article className="swipeCard swipeCardGhost" style={nextStyle}>
            <div className="swipeCardContent">
              <span className="swipeBadge">Up next</span>
              <p className="swipeText">{nextCard.content}</p>
            </div>
          </article>
        ) : null}
        <article
          className="swipeCard"
          style={activeStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="button"
          tabIndex={0}
        >
          <div className="swipeCardContent">
            <div className="swipeHeader">
              <span className="swipeBadge">Caption</span>
              <span className="swipeDate">{activeCard.createdLabel}</span>
            </div>
            <p className="swipeText">{activeCard.content}</p>
            {activeCard.imageUrl ? (
              <div className="swipeImageFrame">
                <img
                  className="swipeImage"
                  src={activeCard.imageUrl}
                  alt={activeCard.imageDescription || "Caption image"}
                />
              </div>
            ) : null}
            <div className="swipeFooter">
              <span>Score: {activeCard.likeCount}</span>
              <span>{swipeLabel}</span>
            </div>
          </div>
        </article>
      </div>

      <div className="swipeControls">
        <button
          className="button buttonGhost swipeButton swipeButtonLeft"
          type="button"
          onClick={() => triggerSwipe("nope")}
          aria-label="Swipe left"
        >
          ←
        </button>
        <button
          className="button swipeButton swipeButtonRight"
          type="button"
          onClick={() => triggerSwipe("like")}
          aria-label="Swipe right"
        >
          →
        </button>
      </div>

      {isLoadingMore ? <div className="swipeStatus">Loading more...</div> : null}
      {statusMessage ? <div className="swipeStatus">{statusMessage}</div> : null}
      {errorMessage ? <div className="formError">{errorMessage}</div> : null}
    </section>
  );
}
