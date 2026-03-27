import { useEffect, useState } from "react";
import { X, ChevronRight, ExternalLink, ChevronDown } from "lucide-react";
import type { GraphNode, GraphEdge, DependencyType, Dependency, PolicyOverlapEdge } from "@/types/graph";
import { DEPENDENCY_COLOR_MAP, DEPENDENCY_TYPES } from "@/types/graph";

const POLICY_OVERLAP_COLOR = "hsl(38, 90%, 55%)";

interface NodeInfoPanelProps {
  node: GraphNode | null;
  selectedEdge: GraphEdge | null;
  selectedPolicyEdge: PolicyOverlapEdge | null;
  policyTaxonMap: Record<string, string>;
  edges: GraphEdge[];
  nodes: GraphNode[];
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

function getEdgeId(e: GraphEdge, end: "source" | "target"): string {
  const v = e[end];
  return typeof v === "string" ? v : v.id;
}

export default function NodeInfoPanel({
  node,
  selectedEdge,
  selectedPolicyEdge,
  policyTaxonMap,
  edges,
  nodes,
  isOpen,
  onClose,
  onToggle,
}: NodeInfoPanelProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex-shrink-0 w-6 bg-card border-l border-border flex items-center justify-center hover:bg-muted transition-colors"
        aria-label="Open info panel"
      >
        <ChevronRight className="h-4 w-4 text-muted-foreground rotate-180" />
      </button>
    );
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const runsServices = node
    ? edges.filter((e) => e.type === "runs_service" && getEdgeId(e, "source") === node.id)
    : [];
  const worksWith = node
    ? edges.filter((e) => e.type === "works_with" && getEdgeId(e, "source") === node.id)
    : [];
  const dependsOn = node
    ? edges.filter((e) => e.type === "depends_on" && getEdgeId(e, "source") === node.id)
    : [];
  const dependedOnBy = node
    ? edges.filter((e) => e.type === "depends_on" && getEdgeId(e, "target") === node.id)
    : [];

  return (
    <div className="flex-shrink-0 w-[360px] bg-card border-l border-border flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {selectedPolicyEdge ? "Policy overlap" : selectedEdge ? "Edge details" : "Node details"}
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Collapse panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedPolicyEdge ? (
          <PolicyOverlapEdgeContent edge={selectedPolicyEdge} nodeMap={nodeMap} policyTaxonMap={policyTaxonMap} />
        ) : selectedEdge ? (
          <EdgeContent edge={selectedEdge} nodeMap={nodeMap} />
        ) : !node ? (
          <p className="text-sm text-muted-foreground italic">
            Click a node or edge on the graph to see details.
          </p>
        ) : node.type === "organisation" ? (
          <OrgContent
            node={node}
            runsServices={runsServices}
            worksWith={worksWith}
            dependsOn={dependsOn}
            dependedOnBy={dependedOnBy}
            nodeMap={nodeMap}
          />
        ) : (
          <ServiceContent node={node} nodeMap={nodeMap} edges={edges} />
        )}
      </div>
    </div>
  );
}

/* ---- Policy Overlap Edge ---- */
function PolicyOverlapEdgeContent({
  edge,
  nodeMap,
  policyTaxonMap,
}: {
  edge: PolicyOverlapEdge;
  nodeMap: Map<string, GraphNode>;
  policyTaxonMap: Record<string, string>;
}) {
  const sourceName = nodeMap.get(edge.source)?.name || edge.source;
  const targetName = nodeMap.get(edge.target)?.name || edge.target;

  function topicSearchUrl(topic: string) {
    const contentId = policyTaxonMap[topic];
    const base = "https://www.gov.uk/search/policy-papers-and-consultations";
    const params = new URLSearchParams();
    params.append("organisations[]", edge.source);
    params.append("organisations[]", edge.target);
    if (contentId) params.append("level_one_taxon", contentId);
    else params.append("keywords", topic);
    return `${base}?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-foreground leading-tight">Policy overlap</h3>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-medium text-foreground">{sourceName}</span>
          {" · "}
          <span className="font-medium text-foreground">{targetName}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {edge.topic_count} shared topic{edge.topic_count !== 1 ? "s" : ""} · overlap score{" "}
          <span className="font-semibold text-foreground">{edge.total_score.toLocaleString()}</span>
        </p>
      </div>

      <div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Shared policy areas
        </span>
        <div className="flex flex-col gap-2 mt-2">
          {edge.topics.map((t) => (
            <div key={t.topic} className="border border-border rounded px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: POLICY_OVERLAP_COLOR }}
                  />
                  <span className="text-sm text-foreground font-medium truncate">{t.topic}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-mono text-muted-foreground">score {t.score}</span>
                  <a
                    href={topicSearchUrl(t.topic)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                    title="View publications on GOV.UK"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
              <div className="flex gap-4 mt-1.5 pl-4.5 text-xs text-muted-foreground">
                <span>{sourceName.split(" ").slice(0, 3).join(" ")}: <span className="text-foreground font-medium">{t.count_a.toLocaleString()}</span> pubs</span>
                <span>{targetName.split(" ").slice(0, 3).join(" ")}: <span className="text-foreground font-medium">{t.count_b.toLocaleString()}</span> pubs</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Edge ---- */
function EdgeContent({
  edge,
  nodeMap,
}: {
  edge: GraphEdge;
  nodeMap: Map<string, GraphNode>;
}) {
  const sourceId = typeof edge.source === "string" ? edge.source : edge.source.id;
  const targetId = typeof edge.target === "string" ? edge.target : edge.target.id;
  const sourceName = nodeMap.get(sourceId)?.name || sourceId;
  const targetName = nodeMap.get(targetId)?.name || targetId;
  const deps = edge.dependencies || [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-foreground leading-tight">{edge.type === "depends_on" ? "Dependency Details" : "Relationship Details"}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-medium text-foreground">{sourceName}</span>
          {" → "}
          <span className="font-medium text-foreground">{targetName}</span>
        </p>
        {edge.total_weight != null && (
          <p className="text-xs text-muted-foreground mt-1">
            Total weight: <span className="font-semibold text-foreground">{edge.total_weight}</span>
          </p>
        )}
      </div>

      {edge.type === "depends_on" && deps.length > 0 ? (
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Dependencies ({deps.length})
          </span>
          <div className="flex flex-col gap-3 mt-2">
            {deps.map((dep, i) => (
              <div key={i} className="flex gap-2 border border-border rounded px-2 py-2">
                <span
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: DEPENDENCY_COLOR_MAP[dep.dependency_type as DependencyType] }}
                />
                <div className="min-w-0">
                  <div className="text-sm text-foreground font-medium">{dep.reason}</div>
                  {dep.evidence && (
                    <div className="text-xs text-muted-foreground mt-0.5">{dep.evidence}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="capitalize">{dep.dependency_type.replace(/_/g, " ")}</span> · weight {dep.weight}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</span>
          <p className="text-sm text-foreground capitalize mt-1">{edge.type.replace(/_/g, " ")}</p>
        </div>
      )}
    </div>
  );
}

/* ---- Organisation ---- */
function OrgContent({
  node,
  runsServices,
  worksWith,
  dependsOn,
  dependedOnBy,
  nodeMap,
}: {
  node: GraphNode;
  runsServices: GraphEdge[];
  worksWith: GraphEdge[];
  dependsOn: GraphEdge[];
  dependedOnBy: GraphEdge[];
  nodeMap: Map<string, GraphNode>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-foreground leading-tight">{node.name}</h3>
        {node.org_type && (
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {node.org_type.replace(/_/g, " ")}
          </p>
        )}
        {node.parent_department && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Parent: {node.parent_department}
          </p>
        )}
      </div>

      {node.staff_count != null && (
        <Stat label="Staff" value={node.staff_count.toLocaleString()} />
      )}

      <StatWithList
        label="Runs services"
        count={runsServices.length}
        items={runsServices.map((e) => nodeMap.get(getEdgeId(e, "target"))?.name || getEdgeId(e, "target"))}
      />
      <StatWithList
        label="Works with"
        count={worksWith.length}
        items={worksWith.map((e) => nodeMap.get(getEdgeId(e, "target"))?.name || getEdgeId(e, "target"))}
      />

      {/* Depends on — grouped by dependency type */}
      <DependencySection
        label="Depends on"
        edges={dependsOn}
        nodeMap={nodeMap}
        peerEnd="target"
      />

      <DependencySection
        label="Depended on by"
        edges={dependedOnBy}
        nodeMap={nodeMap}
        peerEnd="source"
      />

      {node.url && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View on GOV.UK
        </a>
      )}
    </div>
  );
}

/* ---- Dependency Section ---- */
function DependencySection({
  label,
  edges,
  nodeMap,
  peerEnd,
}: {
  label: string;
  edges: GraphEdge[];
  nodeMap: Map<string, GraphNode>;
  peerEnd: "source" | "target";
}) {
  const [expandedEdge, setExpandedEdge] = useState<string | null>(null);

  if (edges.length === 0) {
    return (
      <div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <p className="text-sm text-foreground font-semibold">0</p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className="text-sm text-foreground font-semibold mb-1">{edges.length}</p>
      <div className="flex flex-col gap-1">
        {edges.map((edge) => {
          const peerId = getEdgeId(edge, peerEnd);
          const peerName = nodeMap.get(peerId)?.name || peerId;
          const isExpanded = expandedEdge === peerId;
          const deps = edge.dependencies || [];
          // Collect unique dependency type badges
          const depTypes = [...new Set(deps.map((d) => d.dependency_type))];

          return (
            <div key={peerId} className="border border-border rounded px-2 py-1.5">
              <button
                onClick={() => setExpandedEdge(isExpanded ? null : peerId)}
                className="flex items-center justify-between w-full text-left gap-1"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm text-foreground truncate">{peerName}</span>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {depTypes.map((dt) => (
                      <span
                        key={dt}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: DEPENDENCY_COLOR_MAP[dt as DependencyType] }}
                        title={dt.replace(/_/g, " ")}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-mono">{edge.total_weight}</span>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>
              {isExpanded && deps.length > 0 && (
                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                  {deps.map((dep, i) => (
                    <div key={i} className="flex gap-2">
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: DEPENDENCY_COLOR_MAP[dep.dependency_type as DependencyType] }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs text-foreground">{dep.reason}</div>
                        {dep.evidence && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{dep.evidence}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {dep.dependency_type.replace(/_/g, " ")} · weight {dep.weight}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Service ---- */
function ServiceContent({
  node,
  nodeMap,
  edges,
}: {
  node: GraphNode;
  nodeMap: Map<string, GraphNode>;
  edges: GraphEdge[];
}) {
  const runBy = edges
    .filter((e) => e.type === "runs_service" && getEdgeId(e, "target") === node.id)
    .map((e) => nodeMap.get(getEdgeId(e, "source"))?.name || getEdgeId(e, "source"));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-bold text-foreground leading-tight">{node.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Service</p>
      </div>

      {runBy.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Organisation
          </span>
          <ul className="mt-1">
            {runBy.map((name) => (
              <li key={name} className="text-sm text-foreground">{name}</li>
            ))}
          </ul>
        </div>
      )}

      {node.phase && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phase</span>
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
              node.phase === "Live"
                ? "bg-green-100 text-green-800"
                : node.phase === "Beta"
                ? "bg-yellow-100 text-yellow-800"
                : node.phase === "Alpha"
                ? "bg-orange-100 text-orange-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {node.phase}
          </span>
        </div>
      )}

      {node.tags && node.tags.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {node.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {node.theme && (
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Theme</span>
          <p className="text-sm text-foreground mt-0.5">{node.theme}</p>
        </div>
      )}

      {node.description && (
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Description
          </span>
          <p className="text-sm text-foreground mt-0.5">{node.description}</p>
        </div>
      )}

      {node.url && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Visit service
        </a>
      )}
    </div>
  );
}

/* ---- Helpers ---- */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className="text-sm text-foreground font-semibold">{value}</p>
    </div>
  );
}

function StatWithList({
  label,
  count,
  items,
}: {
  label: string;
  count: number;
  items: string[];
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <p className="text-sm text-foreground font-semibold">{count}</p>
      {items.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {items.map((name) => (
            <li key={name} className="text-xs text-muted-foreground">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
