import { z } from "zod";

export const projectCreateSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1)
});

export const runPipelineSchema = z.object({
  projectId: z.string().min(1)
});

export const urlExtractorInputSchema = z.object({
  domain: z.string().min(1),
  moneyPages: z.array(z.string()).optional(),
  depth: z.number().int().min(0).optional()
});

export const competitorInputSchema = z.object({
  competitorDomains: z.array(z.string()).min(1),
  keyPages: z.array(z.string()).optional()
});

export const dataSourceInputSchema = z.object({
  sources: z.record(z.unknown())
});

export const keywordExpanderInputSchema = z.object({
  seedFamilies: z.array(z.string()),
  competitorGaps: z.array(z.string()),
  dataSourceTerms: z
    .array(z.object({ term: z.string(), source: z.string() }))
    .optional()
});

export const clusteringInputSchema = z.object({
  keywords: z.array(z.object({ keyword: z.string(), source: z.string() })),
  existingTaxonomy: z
    .object({
      L1: z.array(z.unknown()),
      L2: z.array(z.unknown()),
      L3: z.array(z.unknown())
    })
    .optional()
});

export const intentInputSchema = z.object({
  clusters: z.object({
    L1: z.array(z.unknown()),
    L2: z.array(z.unknown()),
    L3: z.array(z.unknown())
  }),
  keywords: z.array(
    z.object({ keyword: z.string(), clusterId: z.string(), intent: z.string().optional() })
  )
});

export const routerInputSchema = z.object({
  clusters: z.object({
    L1: z.array(z.unknown()),
    L2: z.array(z.unknown()),
    L3: z.array(z.unknown())
  }),
  intents: z.array(z.string()),
  userStates: z.object({
    jobs: z.array(z.string()),
    constraints: z.array(z.string()),
    outcomes: z.array(z.string())
  })
});

export const stage1InputSchema = z.object({
  targetUrl: z.string().min(1),
  competitors: z.array(z.string()).optional(),
  initialClusters: z.array(z.string()).optional(),
  industry: z.string().optional(),
  audience: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  marketType: z.enum(["b2b", "b2c"])
});

export const stage1ClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  intentStage: z.string().optional(),
  concern: z.string().optional(),
  score: z.number().optional()
});

export const stage1KeywordRowSchema = z.object({
  Keyword: z.string(),
  "Search Volume": z.union([z.number(), z.string()]).optional(),
  CPC: z.union([z.number(), z.string()]).optional(),
  Competition: z.union([z.number(), z.string()]).optional(),
  "Intent Stage": z.string().optional(),
  "Source Type (brand/generic)": z.string().optional(),
  Competitor: z.string().optional(),
  "Competitors Bidding": z.string().optional(),
  Cluster: z.string().optional(),
  Concern: z.string().optional()
});
