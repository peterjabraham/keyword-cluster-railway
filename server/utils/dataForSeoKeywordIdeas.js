const chunkArray = (items = [], size = 1) => {
  const safeSize = Math.max(1, Number(size) || 1);
  const result = [];
  for (let i = 0; i < (items ?? []).length; i += safeSize) {
    result.push(items.slice(i, i + safeSize));
  }
  return result;
};

const tokenize = (value) =>
  (value ?? "")
    .toString()
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

const overlapScore = (aTokens, bTokens) => {
  if (!aTokens.length || !bTokens.length) {
    return 0;
  }
  const bSet = new Set(bTokens);
  let score = 0;
  aTokens.forEach((token) => {
    if (bSet.has(token)) {
      score += 1;
    }
  });
  return score;
};

/**
 * Normalize DataForSEO `keywords_for_keywords` results into a Map of:
 *   seedKeyword -> [ideaItem, ideaItem, ...]
 *
 * Handles two possible shapes:
 * 1) Nested by seed (preferred):
 *    result = [ { keyword: "<seed>", items: [ { keyword: "<idea>", ... }, ... ] }, ... ]
 *
 * 2) Flat list of ideas:
 *    result = [ { keyword: "<idea>", ... }, ... ]
 *    In this case, we best-effort assign each idea to the closest seed by token overlap.
 */
const groupKeywordIdeasBySeed = (result = [], seedKeywords = []) => {
  const seeds = (seedKeywords ?? []).map((s) => s?.toString?.().trim?.() ?? "").filter(Boolean);
  const grouped = new Map();
  seeds.forEach((seed) => grouped.set(seed, []));

  const arr = Array.isArray(result) ? result : [];
  if (!arr.length) {
    return grouped;
  }

  const looksNested = Array.isArray(arr?.[0]?.items);
  if (looksNested) {
    arr.forEach((entry) => {
      const seed = (entry?.keyword ?? "").toString().trim();
      const items = Array.isArray(entry?.items) ? entry.items : [];
      if (!seed) {
        return;
      }
      if (!grouped.has(seed)) {
        grouped.set(seed, []);
      }
      grouped.get(seed).push(...items);
    });
    return grouped;
  }

  // Flat fallback: assign to best matching seed by token overlap.
  const seedTokens = seeds.map((seed) => ({ seed, tokens: tokenize(seed) }));
  arr.forEach((idea) => {
    const keyword = (idea?.keyword ?? "").toString().trim();
    if (!keyword) {
      return;
    }
    const ideaTokens = tokenize(keyword);
    let bestSeed = seeds[0] ?? "";
    let best = -1;
    seedTokens.forEach(({ seed, tokens }) => {
      const score = overlapScore(ideaTokens, tokens);
      if (score > best) {
        best = score;
        bestSeed = seed;
      }
    });
    if (!bestSeed) {
      return;
    }
    if (!grouped.has(bestSeed)) {
      grouped.set(bestSeed, []);
    }
    grouped.get(bestSeed).push(idea);
  });

  return grouped;
};

module.exports = {
  chunkArray,
  groupKeywordIdeasBySeed
};

