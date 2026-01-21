import { routerInputSchema } from "../shared/schemas";
import { badRequest, jsonResponse } from "../shared/utils";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ message: "User State Router" });
    }
    const body = await request.json().catch(() => null);
    const parsed = routerInputSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid router input", parsed.error.format());
    }

    return jsonResponse({
      routingTable: [
        {
          job: "Choose",
          constraint: "Risk",
          outcome: "Growth",
          pageType: "comparison",
          url: "",
          proofBlock: "case studies",
          cta: "Book a demo"
        }
      ],
      pageRequirements: ["above-the-fold proof", "pricing transparency"],
      proofBlocks: ["SOC2 report", "ROI calculator"]
    });
  }
};
