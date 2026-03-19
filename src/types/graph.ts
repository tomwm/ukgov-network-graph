export type DependencyType =
  | "governance"
  | "shared_service"
  | "data_sharing"
  | "platform"
  | "regulatory"
  | "operational"
  | "financial";

export interface Dependency {
  dependency_type: DependencyType;
  reason: string;
  weight: number;
  evidence?: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: "organisation" | "service";
  org_type?: string;
  staff_count?: number;
  phase?: string;
  theme?: string;
  description?: string;
  tags?: string[];
  organisations?: string[];
  url?: string;
  parent_department?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "works_with" | "runs_service" | "depends_on";
  /** Only for depends_on edges */
  dependencies?: Dependency[];
  /** Primary (highest-weight) dependency type */
  primary_dependency_type?: DependencyType;
  total_weight?: number;
  reason?: string;
  weight?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Maps lowercase alias → node id for search */
  aliasMap: Map<string, string>;
}

export const DEPENDENCY_TYPES: { type: DependencyType; label: string; color: string }[] = [
  { type: "governance", label: "Governance", color: "#94a3b8" },
  { type: "shared_service", label: "Shared service", color: "#22c55e" },
  { type: "data_sharing", label: "Data sharing", color: "#f97316" },
  { type: "platform", label: "Platform", color: "#3b82f6" },
  { type: "regulatory", label: "Regulatory", color: "#a855f7" },
  { type: "operational", label: "Operational", color: "#eab308" },
  { type: "financial", label: "Financial", color: "#64748b" },
];

export const DEPENDENCY_COLOR_MAP: Record<DependencyType, string> = Object.fromEntries(
  DEPENDENCY_TYPES.map((d) => [d.type, d.color])
) as Record<DependencyType, string>;
