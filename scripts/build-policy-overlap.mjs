/**
 * build-policy-overlap.mjs
 *
 * Builds a policy overlap dataset by:
 * 1. Fetching publication counts per org per policy topic from the GOV.UK Search API
 * 2. Computing pairwise overlap scores between orgs that share a topic
 * 3. Writing src/data/uk_gov_policy_overlap.json
 *
 * Run: node scripts/build-policy-overlap.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Top-level GOV.UK policy taxons (base_path → human label)
const TAXON_PATHS = [
  { path: "/business-and-industry",        label: "Business and industry" },
  { path: "/crime-justice-and-law",        label: "Crime, justice and law" },
  { path: "/defence-and-armed-forces",     label: "Defence and armed forces" },
  { path: "/education",                    label: "Education" },
  { path: "/environment",                  label: "Environment" },
  { path: "/health-and-social-care",       label: "Health and social care" },
  { path: "/housing-local-and-community",  label: "Housing and communities" },
  { path: "/money",                        label: "Money and tax" },
  { path: "/society-and-culture",          label: "Society and culture" },
  { path: "/transport",                    label: "Transport" },
  { path: "/welfare",                      label: "Welfare" },
  { path: "/work",                         label: "Work" },
  { path: "/regional-and-local-government", label: "Regional government" },
  { path: "/life-circumstances",           label: "Life circumstances" },
  // Note: /international-affairs, /entering-and-staying-in-the-uk,
  // /science-and-technology, /government are not valid taxon paths on GOV.UK.
  // Sub-topics used instead:
  { path: "/business-and-industry/science-and-innovation", label: "Science and innovation" },
];

// Publication types to count as "policy work"
const DOC_TYPES = [
  "policy_paper",
  "consultation",
  "research_and_analysis",
  "impact_assessment",
  "statutory_guidance",
  "official_statistics",
];

// Minimum publications for an org to be considered "active" in a topic
const MIN_PUBLICATIONS = 5;

// Minimum overlap score to include an edge (geometric mean of pub counts)
const MIN_OVERLAP_SCORE = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "ukgov-network-graph/1.0 (policy overlap builder)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function getTaxonContentId(path) {
  const data = await fetchJSON(`https://www.gov.uk/api/content${path}`);
  return data.content_id;
}

async function getOrgCountsForTaxon(taxonContentId, docTypes) {
  const typeParams = docTypes
    .map((t) => `filter_content_store_document_type[]=${t}`)
    .join("&");
  const url = `https://www.gov.uk/api/search.json?count=0&${typeParams}&filter_part_of_taxonomy_tree=${taxonContentId}&aggregate_organisations=500`;
  const data = await fetchJSON(url);

  const options = data?.aggregates?.organisations?.options || [];
  const counts = {};
  for (const opt of options) {
    const slug = opt.value?.slug;
    const docs = opt.documents;
    if (slug && docs >= MIN_PUBLICATIONS) {
      counts[slug] = docs;
    }
  }
  return { total: data.total || 0, counts };
}

async function main() {
  // Load org slugs from the app's data
  const orgData = JSON.parse(
    readFileSync(join(ROOT, "src/data/uk_gov_organisations_and_services.json"), "utf8")
  );
  const appOrgSlugs = new Set(orgData.organisations.map((o) => o.slug));
  console.log(`Loaded ${appOrgSlugs.size} org slugs from app data`);

  // Step 1: Resolve taxon content IDs
  console.log("\nResolving taxon IDs...");
  const taxons = [];
  for (const { path, label } of TAXON_PATHS) {
    try {
      const content_id = await getTaxonContentId(path);
      taxons.push({ path, label, content_id });
      console.log(`  ✓ ${label} → ${content_id}`);
    } catch (e) {
      console.warn(`  ✗ ${label} (${path}): ${e.message}`);
    }
    await sleep(150);
  }

  // Step 2: For each taxon, get org publication counts
  console.log("\nFetching publication counts per taxon...");
  // orgTopicCounts[orgSlug][topicLabel] = count
  const orgTopicCounts = {};

  for (const taxon of taxons) {
    console.log(`  Fetching: ${taxon.label}...`);
    try {
      const { total, counts } = await getOrgCountsForTaxon(taxon.content_id, DOC_TYPES);
      console.log(`    → ${total} total docs, ${Object.keys(counts).length} orgs active`);

      for (const [slug, count] of Object.entries(counts)) {
        // Only track orgs that are in our app's graph
        if (!appOrgSlugs.has(slug)) continue;
        if (!orgTopicCounts[slug]) orgTopicCounts[slug] = {};
        orgTopicCounts[slug][taxon.label] = count;
      }
    } catch (e) {
      console.warn(`    ✗ ${taxon.label}: ${e.message}`);
    }
    await sleep(200);
  }

  console.log(`\nOrgs with activity in our graph: ${Object.keys(orgTopicCounts).length}`);

  // Step 3: Compute pairwise overlap edges
  console.log("Computing pairwise overlaps...");
  const overlapEdges = [];
  const orgSlugsWithData = Object.keys(orgTopicCounts);

  for (let i = 0; i < orgSlugsWithData.length; i++) {
    for (let j = i + 1; j < orgSlugsWithData.length; j++) {
      const slugA = orgSlugsWithData[i];
      const slugB = orgSlugsWithData[j];
      const topicsA = orgTopicCounts[slugA];
      const topicsB = orgTopicCounts[slugB];

      const sharedTopics = [];
      for (const topic of Object.keys(topicsA)) {
        if (topicsB[topic]) {
          const countA = topicsA[topic];
          const countB = topicsB[topic];
          // Geometric mean: high only when both are genuinely active
          const score = Math.round(Math.sqrt(countA * countB));
          if (score >= MIN_OVERLAP_SCORE) {
            sharedTopics.push({ topic, count_a: countA, count_b: countB, score });
          }
        }
      }

      if (sharedTopics.length > 0) {
        // Sort topics by score descending
        sharedTopics.sort((a, b) => b.score - a.score);
        const totalScore = sharedTopics.reduce((s, t) => s + t.score, 0);
        overlapEdges.push({
          source: slugA,
          target: slugB,
          topics: sharedTopics,
          total_score: totalScore,
          topic_count: sharedTopics.length,
        });
      }
    }
  }

  // Sort edges by total score descending
  overlapEdges.sort((a, b) => b.total_score - a.total_score);
  console.log(`Generated ${overlapEdges.length} overlap edges`);

  // Step 4: Build topic index (topic → orgs sorted by publication count)
  const topicIndex = {};
  for (const taxon of taxons) {
    const label = taxon.label;
    const orgsInTopic = [];
    for (const [slug, topics] of Object.entries(orgTopicCounts)) {
      if (topics[label]) {
        orgsInTopic.push({ slug, count: topics[label] });
      }
    }
    if (orgsInTopic.length > 0) {
      orgsInTopic.sort((a, b) => b.count - a.count);
      topicIndex[label] = orgsInTopic;
    }
  }

  // Step 5: Write output
  const output = {
    generated: new Date().toISOString().split("T")[0],
    doc_types: DOC_TYPES,
    min_publications_threshold: MIN_PUBLICATIONS,
    min_overlap_score: MIN_OVERLAP_SCORE,
    taxons: taxons.map((t) => ({ label: t.label, content_id: t.content_id })),
    summary: {
      orgs_with_policy_activity: Object.keys(orgTopicCounts).length,
      overlap_edges: overlapEdges.length,
      topics: Object.keys(topicIndex).length,
    },
    // Per-org topic footprint
    org_topics: orgTopicCounts,
    // Pairwise overlap edges (top 1000 to keep file size manageable)
    overlap_edges: overlapEdges.slice(0, 1000),
    // Topic → orgs index for the topic picker
    topic_index: topicIndex,
  };

  const outPath = join(ROOT, "src/data/uk_gov_policy_overlap.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${outPath}`);
  console.log(`Summary:`, output.summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
