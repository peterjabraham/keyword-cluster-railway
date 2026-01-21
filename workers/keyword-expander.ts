import { keywordExpanderInputSchema } from "../shared/schemas";
import { badRequest, jsonResponse } from "../shared/utils";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ message: "Keyword Expander" });
    }
    const body = await request.json().catch(() => null);
    const parsed = keywordExpanderInputSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid keyword expander input", parsed.error.format());
    }

    const expandedKeywords = parsed.data.seedFamilies.map((seed) => ({
      keyword: `${seed} tools`,
      source: "seed"
    }));

    return jsonResponse({
      expandedKeywords,
      suggestedQueries: ["best seo clustering tool", "keyword clustering api"],
      serpSuggestions: ["how to cluster keywords"]
    });
  }
};
