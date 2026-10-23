import type { APIRoute } from "astro";
import { loadModels } from "../../../lib/data.ts";
import { rankingJson } from "../../../lib/ranking-data.ts";
import { RANKINGS, type RankingDef } from "../../../lib/rankings.ts";

/** One JSON per ranking for the browser filters (ADR-0015, detail 1). Same slug as the page URL. */
export function getStaticPaths() {
  return RANKINGS.map((ranking) => ({
    params: { ranking: ranking.url.split("/").pop()! },
    props: { ranking },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const { ranking } = props as { ranking: RankingDef };
  const body = rankingJson(loadModels().models, ranking);
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
};
