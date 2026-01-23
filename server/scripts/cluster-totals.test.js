const assert = require("assert");
const {
  computeStage1ClusterTotals,
  stage1ClusterTotalsToCsv
} = require("../utils/clusterTotals");

const clusters = [
  { name: "Cluster A", intentStage: "awareness" },
  { name: "Cluster B", intentStage: "consideration" },
  { name: "Cluster C", intentStage: "decision" }
];

const keywordRows = [
  { Cluster: "Cluster A", "Search Volume": 10 },
  { Cluster: "Cluster A", "Search Volume": "20" },
  { Cluster: "Cluster B", "Search Volume": "not-a-number" },
  { Cluster: "Cluster B", "Search Volume": 5.4 },
  { Cluster: "Missing Cluster", "Search Volume": 7, "Intent Stage": "conversion" },
  { Cluster: "", "Search Volume": 3 } // should map to General
];

const rows = computeStage1ClusterTotals(clusters, keywordRows);
const csv = stage1ClusterTotalsToCsv(rows);
const csvLines = csv.split("\n");
assert.strictEqual(csvLines[0], "Cluster,Intent Stage,Total Search Volume");

const rowByCluster = Object.fromEntries(rows.map((row) => [row.Cluster, row]));

assert.strictEqual(rowByCluster["Cluster A"]["Intent Stage"], "awareness");
assert.strictEqual(rowByCluster["Cluster A"]["Total Search Volume"], 30);

assert.strictEqual(rowByCluster["Cluster B"]["Intent Stage"], "consideration");
// 0 + 5.4 -> rounded to 5
assert.strictEqual(rowByCluster["Cluster B"]["Total Search Volume"], 5);

assert.strictEqual(rowByCluster["Cluster C"]["Intent Stage"], "decision");
assert.strictEqual(rowByCluster["Cluster C"]["Total Search Volume"], 0);

assert.strictEqual(rowByCluster["Missing Cluster"]["Intent Stage"], "decision");
assert.strictEqual(rowByCluster["Missing Cluster"]["Total Search Volume"], 7);

assert.strictEqual(rowByCluster["General"]["Total Search Volume"], 3);

// ordering: awareness -> consideration -> decision
const intentsInOrder = rows.map((row) => row["Intent Stage"]);
const firstAwareness = intentsInOrder.indexOf("awareness");
const firstConsideration = intentsInOrder.indexOf("consideration");
const firstDecision = intentsInOrder.indexOf("decision");
assert.ok(firstAwareness !== -1 && firstConsideration !== -1 && firstDecision !== -1);
assert.ok(firstAwareness < firstConsideration);
assert.ok(firstConsideration < firstDecision);

// CSV should include at least one known cluster row.
assert.ok(csv.includes('"Cluster A","awareness","30"'));

console.log("cluster-totals.test.js passed");

