const assert = require("assert");
const { limitClusters } = require("../utils/clusterLimiter");

const clusters = Array.from({ length: 30 }).map((_, index) => ({
  id: `c-${index + 1}`,
  name: `Cluster ${index + 1}`,
  score: index + 1,
  intentStage: index % 3 === 0 ? "awareness" : index % 3 === 1 ? "consideration" : "decision"
}));

// No limit should always return all clusters, even if maxClusters is set.
{
  const out = limitClusters(clusters, 12, "none");
  assert.strictEqual(out.length, 30);
}

// Top mode should take maxClusters by score.
{
  const out = limitClusters(clusters, 12, "top");
  assert.strictEqual(out.length, 12);
  assert.strictEqual(out[0].score, 30);
  assert.strictEqual(out[11].score, 19);
}

// Banded should still respect maxClusters.
{
  const out = limitClusters(clusters, 12, "banded");
  assert.strictEqual(out.length, 12);
}

console.log("cluster-limiter.test.js passed");

