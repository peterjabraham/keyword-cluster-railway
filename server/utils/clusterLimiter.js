const limitClusters = (clusters = [], maxClusters = 0, mode = "none") => {
  const normalizedMode = (mode ?? "none").toString().toLowerCase();
  if (normalizedMode === "none") {
    return clusters;
  }

  const limit = Number(maxClusters ?? 0);
  if (!limit || limit <= 0 || clusters.length <= limit) {
    return clusters;
  }

  const sorted = [...clusters].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  );

  if (normalizedMode !== "banded") {
    return sorted.slice(0, limit);
  }

  const grouped = sorted.reduce((acc, cluster) => {
    const key = (cluster.intentStage ?? "unknown").toLowerCase();
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(cluster);
    return acc;
  }, {});

  const stages = Object.keys(grouped);
  if (!stages.length) {
    return sorted.slice(0, limit);
  }

  const baseQuota = Math.floor(limit / stages.length);
  const selection = [];

  stages.forEach((stage) => {
    const take = Math.min(grouped[stage].length, baseQuota);
    selection.push(...grouped[stage].slice(0, take));
  });

  let remainder = limit - selection.length;
  if (remainder > 0) {
    const overflow = stages.flatMap((stage) => grouped[stage].slice(baseQuota));
    overflow.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    selection.push(...overflow.slice(0, remainder));
  }

  return selection.slice(0, limit);
};

module.exports = {
  limitClusters
};

