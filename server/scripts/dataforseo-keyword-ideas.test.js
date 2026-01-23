const assert = require("assert");
const { groupKeywordIdeasBySeed, chunkArray } = require("../utils/dataForSeoKeywordIdeas");

// chunking
{
  const chunks = chunkArray([1, 2, 3, 4, 5], 2);
  assert.deepStrictEqual(chunks, [[1, 2], [3, 4], [5]]);
}

// nested shape: result entries per seed keyword
{
  const result = [
    {
      keyword: "alpha",
      items: [{ keyword: "alpha one", search_volume: 10 }]
    },
    {
      keyword: "beta",
      items: [{ keyword: "beta one", search_volume: 20 }]
    }
  ];
  const grouped = groupKeywordIdeasBySeed(result, ["alpha", "beta"]);
  assert.strictEqual(grouped.get("alpha").length, 1);
  assert.strictEqual(grouped.get("beta").length, 1);
  assert.strictEqual(grouped.get("alpha")[0].keyword, "alpha one");
  assert.strictEqual(grouped.get("beta")[0].keyword, "beta one");
}

// flat shape: assign by token overlap
{
  const result = [
    { keyword: "grant management software pricing", search_volume: 100 },
    { keyword: "social value reporting template", search_volume: 50 }
  ];
  const grouped = groupKeywordIdeasBySeed(result, ["grant management software", "social value reporting"]);
  assert.ok(grouped.get("grant management software").length >= 1);
  assert.ok(grouped.get("social value reporting").length >= 1);
}

console.log("dataforseo-keyword-ideas.test.js passed");

