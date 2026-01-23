const INTENT_ORDER = {
  awareness: 0,
  consideration: 1,
  decision: 2
};

const normalizeIntentStage = (value) => {
  const normalized = (value ?? "").toString().trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized === "conversion") {
    return "decision";
  }
  if (normalized === "awareness") {
    return "awareness";
  }
  if (normalized === "consideration") {
    return "consideration";
  }
  if (normalized === "decision") {
    return "decision";
  }
  return normalized;
};

const coerceNumber = (value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Returns rows with headers:
 * - Cluster
 * - Intent Stage
 * - Total Search Volume
 */
const computeStage1ClusterTotals = (clusters = [], keywordRows = []) => {
  const clusterIntentByName = new Map();
  (clusters ?? []).forEach((cluster) => {
    const name = (cluster?.name ?? "").toString().trim();
    if (!name) {
      return;
    }
    const stage = normalizeIntentStage(cluster?.intentStage ?? "");
    clusterIntentByName.set(name, stage);
  });

  const totalsByCluster = new Map();

  // Seed all clusters (even if no keywords, total stays 0).
  (clusters ?? []).forEach((cluster) => {
    const name = (cluster?.name ?? "").toString().trim();
    if (!name) {
      return;
    }
    totalsByCluster.set(name, { total: 0, intentStage: clusterIntentByName.get(name) ?? "" });
  });

  // Add totals from keyword rows.
  (keywordRows ?? []).forEach((row) => {
    const clusterName = (row?.Cluster ?? "").toString().trim() || "General";
    const volume = coerceNumber(row?.["Search Volume"]);
    const rowIntent = normalizeIntentStage(row?.["Intent Stage"] ?? "");

    if (!totalsByCluster.has(clusterName)) {
      const clusterIntent = clusterIntentByName.get(clusterName) ?? "";
      totalsByCluster.set(clusterName, {
        total: 0,
        intentStage: clusterIntent || rowIntent || ""
      });
    } else {
      const existing = totalsByCluster.get(clusterName);
      if (!existing.intentStage) {
        existing.intentStage =
          clusterIntentByName.get(clusterName) ?? rowIntent ?? existing.intentStage;
      }
    }

    const entry = totalsByCluster.get(clusterName);
    entry.total += volume;
  });

  const rows = Array.from(totalsByCluster.entries()).map(([clusterName, data]) => ({
    Cluster: clusterName,
    "Intent Stage": data.intentStage ?? "",
    "Total Search Volume": Math.round(coerceNumber(data.total))
  }));

  rows.sort((a, b) => {
    const aIntent = normalizeIntentStage(a["Intent Stage"]);
    const bIntent = normalizeIntentStage(b["Intent Stage"]);
    const aOrder = INTENT_ORDER[aIntent] ?? 99;
    const bOrder = INTENT_ORDER[bIntent] ?? 99;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    const volDiff =
      coerceNumber(b["Total Search Volume"]) - coerceNumber(a["Total Search Volume"]);
    if (volDiff !== 0) {
      return volDiff;
    }
    return a.Cluster.localeCompare(b.Cluster);
  });

  return rows;
};

const stage1ClusterTotalsColumns = ["Cluster", "Intent Stage", "Total Search Volume"];

const stage1ClusterTotalsToCsv = (rows) => {
  const data = Array.isArray(rows) ? rows : [];
  const escape = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    const text = typeof value === "string" ? value : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [stage1ClusterTotalsColumns.join(",")];
  data.forEach((row) => {
    const line = stage1ClusterTotalsColumns.map((column) => escape(row?.[column]));
    lines.push(line.join(","));
  });
  return lines.join("\n");
};

module.exports = {
  computeStage1ClusterTotals,
  stage1ClusterTotalsToCsv
};

