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
