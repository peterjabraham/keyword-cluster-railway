const baseUrl =
  process.env.STAGE1_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

const run = async () => {
  const input = {
    targetUrl: "https://revitalash.co.uk",
    competitors: [
      "https://grandecosmetics.co.uk/products/grandelash-md",
      "https://rapidlash.co.uk/",
      "https://uk.olaplex.com/products/olaplex-lashbond-building-serum-uk",
      "https://www.beautypie.com/products/lash-fuel-peptide-serum"
    ],
    industry: "Beauty",
    audience: "Consumers",
    constraints: [],
    initialClusters: [],
    marketType: "b2c"
  };

  const createRes = await fetch(`${baseUrl}/api/stage1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!createRes.ok) {
    throw new Error(`Create failed: ${await createRes.text()}`);
  }
  const { projectId } = await createRes.json();

  const clusterRes = await fetch(`${baseUrl}/api/stage1/projects/${projectId}/clusters`, {
    method: "POST"
  });
  if (!clusterRes.ok) {
    throw new Error(`Clusters failed: ${await clusterRes.text()}`);
  }
  const clusterData = await clusterRes.json();
  const clusters = clusterData.clusters ?? [];

  const selectedIds = clusters.slice(0, 5).map((cluster) => cluster.id);
  const keywordsRes = await fetch(
    `${baseUrl}/api/stage1/projects/${projectId}/keywords`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedIds })
    }
  );
  if (!keywordsRes.ok) {
    throw new Error(`Keywords failed: ${await keywordsRes.text()}`);
  }
  const keywordsData = await keywordsRes.json();

  const csvRes = await fetch(
    `${baseUrl}/api/stage1/projects/${projectId}/keywords?format=csv`
  );
  if (!csvRes.ok) {
    throw new Error(`CSV failed: ${await csvRes.text()}`);
  }

  console.log(
    JSON.stringify(
      {
        projectId,
        clusterCount: clusters.length,
        rowCount: keywordsData.rows?.length ?? 0
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
