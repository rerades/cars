import type { APIRoute } from "astro";
import { isComparable, projectModel } from "../../../../lib/compare.ts";
import { loadModels } from "../../../../lib/data.ts";

/**
 * One static JSON per comparable model (PRD-003 RF-11, ADR-0014). Same `{marca}`/`{modelo}` as the
 * model page; models that are not comparable get no path, so they answer 404.
 */
export function getStaticPaths() {
  return loadModels()
    .models.filter(isComparable)
    .map((model) => {
      const [marca, modelo] = model.file.replace(/\.yaml$/, "").split("/");
      return { params: { marca, modelo }, props: { data: projectModel(model, modelo) } };
    });
}

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.data), { headers: { "Content-Type": "application/json" } });
