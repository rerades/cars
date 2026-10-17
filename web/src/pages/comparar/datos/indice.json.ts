import type { APIRoute } from "astro";
import { defaultVersion, isComparable } from "../../../lib/compare.ts";
import { loadModels } from "../../../lib/data.ts";

/**
 * Light index of comparable models (PRD-003 RF-9, RF-11, ADR-0014): names only, no figures.
 * Same `{marca}`/`{modelo}` and same comparable criterion as the per-model JSON.
 */
export const GET: APIRoute = () => {
  const index = loadModels()
    .models.filter(isComparable)
    .map((model) => {
      const [brand, slug] = model.file.replace(/\.yaml$/, "").split("/");
      return {
        brand,
        slug,
        brand_name: model.brand_name,
        model: model.model,
        status: model.status.value,
        versions: model.versions.map((v) => v.name),
        default_version: defaultVersion(model.versions)?.name ?? null,
      };
    });
  return new Response(JSON.stringify(index), { headers: { "Content-Type": "application/json" } });
};
