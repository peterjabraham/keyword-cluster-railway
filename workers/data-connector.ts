import { dataSourceInputSchema } from "../shared/schemas";
import { badRequest, jsonResponse } from "../shared/utils";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ message: "Data Source Connector" });
    }
    const body = await request.json().catch(() => null);
    const parsed = dataSourceInputSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid data source input", parsed.error.format());
    }

    return jsonResponse({
      queryTerms: [{ term: "seo clustering", source: "gsc" }],
      searchPatterns: ["keyword clustering"],
      conversionPaths: ["homepage -> demo"],
      voiceOfCustomer: ["Need faster SEO research"]
    });
  }
};
