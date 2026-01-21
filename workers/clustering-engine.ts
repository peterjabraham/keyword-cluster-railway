import { clusteringInputSchema } from "../shared/schemas";
import { badRequest, jsonResponse } from "../shared/utils";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ message: "Clustering Engine" });
    }
    const body = await request.json().catch(() => null);
    const parsed = clusteringInputSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid clustering input", parsed.error.format());
    }

    const taxonomy = {
      L1: [{ id: "l1-seo", name: "SEO Clustering", children: ["l2-tools"] }],
      L2: [
        {
          id: "l2-tools",
          parentId: "l1-seo",
          name: "Tools",
          children: ["l3-keyword"]
        }
      ],
      L3: [
        {
          id: "l3-keyword",
          parentId: "l2-tools",
          name: "Keyword Clustering",
          children: []
        }
      ]
    };

    const assignments = parsed.data.keywords.map((keyword) => ({
      keyword: keyword.keyword,
      clusterId: "l3-keyword",
      intent: "commercial"
    }));

    return jsonResponse({ taxonomy, assignments });
  }
};
