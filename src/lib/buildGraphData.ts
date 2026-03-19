import orgAndServices from "@/data/uk_gov_organisations_and_services.json";
import depData from "@/data/uk_gov_org_dependency.json";
import staffData from "@/data/uk_gov_org_staff_numbers.json";
import aliasData from "@/data/uk_gov_org_aliases.json";
import type { GraphNode, GraphEdge, GraphData, DependencyType } from "@/types/graph";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

/** Map GOV.UK org_type strings to our simplified categories */
function mapOrgType(raw: string): string {
  if (raw.includes("department")) return "department";
  if (raw.includes("Non-ministerial department")) return "department";
  if (raw.includes("Executive agency") || raw.includes("Executive office") || raw === "Civil service") return "agency";
  if (raw.includes("regulator") || raw === "Public corporation") return "regulator";
  return "public_body";
}

function getPrimaryDependencyType(deps: any[]): DependencyType {
  let best = deps[0];
  for (const d of deps) {
    if (d.weight > best.weight) best = d;
  }
  return best.dependency_type as DependencyType;
}

export function buildGraphData(): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const usedIds = new Set<string>();
  const nameToId = new Map<string, string>();

  const data = orgAndServices as any;

  // Build staff lookup by id
  const staffLookup = new Map<string, number>();
  const staffJson = staffData as any;
  for (const org of staffJson.organisations || []) {
    if (org.staff_count != null) {
      staffLookup.set(org.id, org.staff_count);
    }
  }

  // 1. Organisations (with embedded services)
  for (const org of data.organisations) {
    const id = org.slug;
    if (usedIds.has(id)) continue;
    usedIds.add(id);

    nodes.push({
      id,
      name: org.name,
      type: "organisation",
      org_type: mapOrgType(org.org_type || ""),
      url: org.url,
      parent_department: org.parent_department,
      staff_count: staffLookup.get(id) || undefined,
    });
    nameToId.set(org.name.toLowerCase(), id);

    // "works_with" edge to parent department
    if (org.parent_department) {
      const parentSlug = nameToId.get(org.parent_department.toLowerCase());
      if (parentSlug && parentSlug !== id) {
        edges.push({ source: parentSlug, target: id, type: "works_with" });
      }
    }

    // Services embedded in the org
    if (org.digital_services && Array.isArray(org.digital_services)) {
      for (const svc of org.digital_services) {
        const svcId = "svc_" + (svc.slug || slugify(svc.name));
        if (usedIds.has(svcId)) continue;
        usedIds.add(svcId);

        nodes.push({
          id: svcId,
          name: svc.name,
          type: "service",
          phase: svc.phase || undefined,
          theme: svc.theme || undefined,
          description: svc.description || undefined,
          tags: svc.tags || undefined,
          organisations: svc.organisation || undefined,
          url: svc.liveService || svc.url || undefined,
        });

        edges.push({ source: id, target: svcId, type: "runs_service" });
      }
    }
  }

  // Second pass: create works_with edges for orgs whose parent was added after them
  for (const org of data.organisations) {
    if (!org.parent_department) continue;
    const id = org.slug;
    const parentSlug = nameToId.get(org.parent_department.toLowerCase());
    if (parentSlug && parentSlug !== id) {
      const exists = edges.some(
        (e) =>
          e.type === "works_with" &&
          ((typeof e.source === "string" ? e.source : e.source.id) === parentSlug) &&
          ((typeof e.target === "string" ? e.target : e.target.id) === id)
      );
      if (!exists) {
        edges.push({ source: parentSlug, target: id, type: "works_with" });
      }
    }
  }

  // 2. Dependency edges (new structure with dependencies array)
  const deps = depData as any;
  for (const edge of deps.edges || []) {
    const sourceExists = usedIds.has(edge.source);
    const targetExists = usedIds.has(edge.target);
    if (sourceExists && targetExists) {
      const dependencies = edge.dependencies || [];
      edges.push({
        source: edge.source,
        target: edge.target,
        type: "depends_on",
        dependencies,
        primary_dependency_type: dependencies.length > 0 ? getPrimaryDependencyType(dependencies) : undefined,
        total_weight: edge.total_weight,
      });
    }
  }

  // Build alias map for search
  const aliasMap = new Map<string, string>();
  const aliasJson = aliasData as any;
  for (const entry of aliasJson.aliases || []) {
    if (usedIds.has(entry.id)) {
      for (const alias of entry.aliases || []) {
        aliasMap.set(alias.toLowerCase(), entry.id);
      }
    }
  }

  return { nodes, edges, aliasMap };
}
