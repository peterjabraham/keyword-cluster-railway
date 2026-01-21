import { intentInputSchema } from "../shared/schemas";
import { badRequest, jsonResponse } from "../shared/utils";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ message: "Intent Classifier" });
    }
    const body = await request.json().catch(() => null);
    const parsed = intentInputSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid intent input", parsed.error.format());
    }

    return jsonResponse({
      intentTags: ["commercial", "transactional"],
      serpPageTypes: ["product", "comparison"],
      evidenceRequired: ["case studies", "security proof"]
    });
  }
};
