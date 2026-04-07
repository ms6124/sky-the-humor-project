"use client";

import { useState } from "react";

type DateRange = "all" | "24h" | "7d" | "30d" | "custom";

type FiltersClientProps = {
  queryText: string;
  sort: string;
  dateRange: DateRange;
  startDate: string;
  endDate: string;
  minLikes: number;
};

export default function FiltersClient({
  queryText,
  sort,
  dateRange,
  startDate,
  endDate,
  minLikes,
}: FiltersClientProps) {
  const [range, setRange] = useState<DateRange>(dateRange);
  const isCustom = range === "custom";
  const clearFiltersHref = (() => {
    const params = new URLSearchParams();
    if (queryText) params.set("q", queryText);
    if (sort) params.set("sort", sort);
    params.set("dateRange", "all");
    params.set("minLikes", "0");
    params.set("page", "1");
    return `/captions?${params.toString()}`;
  })();

  return (
    <form className="filterBar" action="/captions" method="get">
      <input type="hidden" name="q" value={queryText} />
      <input type="hidden" name="sort" value={sort} />
      <div className="filterGroup">
        <label className="chipLabel" htmlFor="dateRange">
          Date
        </label>
        <select
          className="filterControl"
          id="dateRange"
          name="dateRange"
          value={range}
          onChange={(event) => setRange(event.target.value as DateRange)}
        >
          <option value="all">All time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div className="filterGroup">
        <label className="chipLabel" htmlFor="minLikes">
          Likes
        </label>
        <select className="filterControl" id="minLikes" name="minLikes" defaultValue={String(minLikes)}>
          <option value="0">0+</option>
          <option value="5">5+</option>
          <option value="10">10+</option>
          <option value="25">25+</option>
        </select>
      </div>
      <div className="filterGroup">
        <label className="chipLabel" htmlFor="startDate">
          From
        </label>
        <input
          className="filterControl"
          type="date"
          id="startDate"
          name="startDate"
          defaultValue={startDate}
          disabled={!isCustom}
        />
      </div>
      <div className="filterGroup">
        <label className="chipLabel" htmlFor="endDate">
          To
        </label>
        <input
          className="filterControl"
          type="date"
          id="endDate"
          name="endDate"
          defaultValue={endDate}
          disabled={!isCustom}
        />
      </div>
      <button className="button buttonSecondary buttonSubtle buttonChipTone" type="submit">
        Apply
      </button>
      <a className="button buttonGhost" href={clearFiltersHref}>
        Clear filters
      </a>
    </form>
  );
}
