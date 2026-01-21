import { urlExtractorInputSchema } from "../shared/schemas";
import { badRequest, jsonResponse } from "../shared/utils";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ message: "URL Extractor" });
    }
    const body = await request.json().catch(() => null);
    const parsed = urlExtractorInputSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid URL extractor input", parsed.error.format());
    }

    const { domain } = parsed.data;
    return jsonResponse({
      navigation: [{ label: "Home", url: `https://${domain}` }],
      pageThemes: [{ url: `https://${domain}/pricing`, theme: "Pricing" }],
      h1h2Patterns: [],
      proofPages: [],
      useCasePages: []
    });
  }
};
