export interface URLExtractorInput {
  domain: string;
  moneyPages?: string[];
  depth?: number;
}

export interface NavItem {
  label: string;
  url: string;
}

export interface PageTheme {
  url: string;
  theme: string;
}

export interface HeadingPattern {
  url: string;
  h1: string;
  h2s: string[];
}

export interface URLExtractorOutput {
  navigation: NavItem[];
  pageThemes: PageTheme[];
  h1h2Patterns: HeadingPattern[];
  proofPages: string[];
  useCasePages: string[];
}

export interface CompetitorInput {
  competitorDomains: string[];
  keyPages?: string[];
}

export interface FeatureFlagMatrix {
  competitors: {
    domain: string;
    features: Record<string, boolean>;
    urls: Record<string, string>;
  }[];
  gaps: string[];
}

export interface CompetitorOutput {
  featureFlags: FeatureFlagMatrix;
  pageTypeInventory: string[];
  missingClusters: string[];
  proofPatterns: string[];
}

export interface DataSourceInput {
  sources: Record<string, unknown>;
}

export interface QueryTerm {
  term: string;
  source: string;
}

export interface DataSourceOutput {
  queryTerms: QueryTerm[];
  searchPatterns: string[];
  conversionPaths: string[];
  voiceOfCustomer: string[];
}

export interface KeywordExpanderInput {
  seedFamilies: string[];
  competitorGaps: string[];
  dataSourceTerms?: QueryTerm[];
}

export interface ExpandedKeyword {
  keyword: string;
  source: string;
}

export interface KeywordExpanderOutput {
  expandedKeywords: ExpandedKeyword[];
  suggestedQueries: string[];
  serpSuggestions: string[];
}

export interface ClusterNode {
  id: string;
  name: string;
  definition?: string;
  parentId?: string;
  children: string[];
}

export interface ClusterTaxonomy {
  L1: ClusterNode[];
  L2: ClusterNode[];
  L3: ClusterNode[];
}

export interface KeywordClusterAssignment {
  keyword: string;
  clusterId: string;
  intent?: string;
}

export interface ClusteringInput {
  keywords: ExpandedKeyword[];
  existingTaxonomy?: ClusterTaxonomy;
}

export interface ClusteringOutput {
  taxonomy: ClusterTaxonomy;
  assignments: KeywordClusterAssignment[];
}

export interface IntentInput {
  clusters: ClusterTaxonomy;
  keywords: KeywordClusterAssignment[];
}

export interface IntentOutput {
  intentTags: string[];
  serpPageTypes: string[];
  evidenceRequired: string[];
}

export interface RouterInput {
  clusters: ClusterTaxonomy;
  intents: string[];
  userStates: {
    jobs: string[];
    constraints: string[];
    outcomes: string[];
  };
}

export interface RoutingRule {
  job: string;
  constraint: string;
  outcome: string;
  pageType: string;
  url?: string;
  proofBlock?: string;
  cta?: string;
}

export interface RouterOutput {
  routingTable: RoutingRule[];
  pageRequirements: string[];
  proofBlocks: string[];
}
