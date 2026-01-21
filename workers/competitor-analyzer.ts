import { competitorInputSchema } from "../shared/schemas";
import { badRequest, jsonResponse } from "../shared/utils";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ message: "Competitor Analyzer" });
    }
    const body = await request.json().catch(() => null);
    const parsed = competitorInputSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid competitor input", parsed.error.format());
    }

    return jsonResponse({
      featureFlags: {
        competitors: parsed.data.competitorDomains.map((domain) => ({
          domain,
          features: { pricing: true, demo: false },
          urls: {}
        })),
        gaps: ["ROI Calculator", "Security"]
      },
      pageTypeInventory: ["Pricing", "Use Case"],
      missingClusters: ["integration automation"],
      proofPatterns: ["case-study", "roi-calculator"]
    });
  }
};
