import { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from "react";
import * as d3 from "d3";
import type { GraphNode, GraphEdge, DependencyType, PolicyOverlapEdge } from "@/types/graph";
import { DEPENDENCY_COLOR_MAP } from "@/types/graph";
import type { Journey } from "@/types/journey";

interface NetworkGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  edgeFilters: { works_with: boolean; runs_service: boolean };
  depFilters: Record<DependencyType, boolean>;
  showServices: boolean;
  showOrganisations: boolean;
  searchTerm: string;
  aliasMap: Map<string, string>;
  onNodeSelect: (node: GraphNode | null) => void;
  onEdgeSelect: (edge: GraphEdge | null) => void;
  onBackgroundClick: () => void;
  selectedNode: GraphNode | null;
  spacing: number;
  edgeLength: number;
  activeJourney: Journey | null;
  policyOverlapEdges: PolicyOverlapEdge[];
  showPolicyOverlap: boolean;
  activePolicyTopic: string | null;
  policyTopicOrgIds: Set<string> | null;
}

export interface NetworkGraphHandle {
  resetLayout: () => void;
  centerOnNode: (nodeId: string) => void;
}

const BASE_EDGE_COLORS: Record<string, string> = {
  works_with: "hsl(210, 10%, 65%)",
  runs_service: "hsl(200, 70%, 60%)",
};

const POLICY_OVERLAP_COLOR = "hsl(38, 90%, 55%)";

const NODE_COLORS: Record<string, string> = {
  department: "hsl(213, 72%, 30%)",
  agency: "hsl(200, 70%, 55%)",
  regulator: "hsl(270, 50%, 50%)",
  public_body: "hsl(270, 50%, 50%)",
  service: "hsl(164, 60%, 40%)",
};

const JOURNEY_COLOR = "#06b6d4";

function getNodeColor(node: GraphNode): string {
  if (node.type === "service") {
    if (node.phase === "Retired") return "hsl(220, 10%, 50%)";
    return NODE_COLORS.service;
  }
  return NODE_COLORS[node.org_type || "department"] || NODE_COLORS.department;
}

function getNodeRadius(node: GraphNode): number {
  if (node.type === "service") return 6;
  if (node.staff_count) {
    return Math.min(40, Math.max(8, Math.sqrt(node.staff_count / 8)));
  }
  if (node.org_type === "department") return 14;
  return 8;
}

function getEdgeColor(edge: GraphEdge): string {
  if (edge.type === "depends_on" && edge.primary_dependency_type) {
    return DEPENDENCY_COLOR_MAP[edge.primary_dependency_type] || "#94a3b8";
  }
  return BASE_EDGE_COLORS[edge.type] || "#94a3b8";
}

function getEdgeWidth(edge: GraphEdge): number {
  if (edge.type === "depends_on" && edge.total_weight) {
    return 1 + Math.log2(edge.total_weight);
  }
  return 1.5;
}

function depEdgeVisible(edge: GraphEdge, depFilters: Record<DependencyType, boolean>): boolean {
  if (!edge.dependencies || edge.dependencies.length === 0) return false;
  return edge.dependencies.some((d) => depFilters[d.dependency_type as DependencyType]);
}

const NetworkGraph = forwardRef<NetworkGraphHandle, NetworkGraphProps>(({
  nodes,
  edges,
  edgeFilters,
  depFilters,
  showServices,
  showOrganisations,
  searchTerm,
  aliasMap,
  onNodeSelect,
  onEdgeSelect,
  onBackgroundClick,
  selectedNode,
  spacing,
  edgeLength,
  activeJourney,
  policyOverlapEdges,
  showPolicyOverlap,
  activePolicyTopic,
  policyTopicOrgIds,
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);

  // Build journey node set and step map
  const journeyNodeIds = new Set<string>();
  const journeyStepMap = new Map<string, number[]>();
  if (activeJourney) {
    for (const step of activeJourney.steps) {
      for (const org of step.organisations) {
        journeyNodeIds.add(org.id);
        const existing = journeyStepMap.get(org.id) || [];
        existing.push(step.step);
        journeyStepMap.set(org.id, existing);
      }
    }
  }

  const filteredNodes = nodes.filter((n) => {
    if (n.type === "service" && !showServices) return false;
    if (n.type === "organisation" && !showOrganisations) return false;
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

  const filteredEdges = edges.filter((e) => {
    const sourceId = typeof e.source === "string" ? e.source : e.source.id;
    const targetId = typeof e.target === "string" ? e.target : e.target.id;
    if (!filteredNodeIds.has(sourceId) || !filteredNodeIds.has(targetId)) return false;
    if (e.type === "depends_on") {
      return depEdgeVisible(e, depFilters);
    }
    return edgeFilters[e.type as keyof typeof edgeFilters] ?? false;
  });

  const searchMatch = useCallback(
    (node: GraphNode) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      if (node.name.toLowerCase().includes(term)) return true;
      const resolvedId = aliasMap.get(term);
      if (resolvedId === node.id) return true;
      for (const [alias, id] of aliasMap) {
        if (id === node.id && alias.includes(term)) return true;
      }
      return false;
    },
    [searchTerm, aliasMap]
  );

  const isConnected = useCallback(
    (nodeId: string) => {
      if (!selectedNode) return true;
      if (nodeId === selectedNode.id) return true;
      return filteredEdges.some((e) => {
        const s = typeof e.source === "string" ? e.source : e.source.id;
        const t = typeof e.target === "string" ? e.target : e.target.id;
        return (s === selectedNode.id && t === nodeId) || (t === selectedNode.id && s === nodeId);
      });
    },
    [selectedNode, filteredEdges]
  );

  useImperativeHandle(ref, () => ({
    resetLayout: () => {
      if (!simulationRef.current || !svgRef.current) return;
      const sim = simulationRef.current;
      sim.nodes().forEach((d: any) => { d.fx = null; d.fy = null; });
      sim.alpha(1).restart();
      const svg = d3.select(svgRef.current);
      if (zoomRef.current) {
        svg.transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity.scale(0.9));
      }
    },
    centerOnNode: (nodeId: string) => {
      if (!simulationRef.current || !svgRef.current || !zoomRef.current) return;
      const node = simulationRef.current.nodes().find((n: any) => n.id === nodeId);
      if (!node || node.x == null || node.y == null) return;
      const svg = d3.select(svgRef.current);
      const width = svgRef.current.clientWidth;
      const height = svgRef.current.clientHeight;
      const scale = 1.5;
      const tx = width / 2 - node.x * scale;
      const ty = height / 2 - node.y * scale;
      svg.transition().duration(600).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      );
    },
  }));

  useEffect(() => {
    if (!simulationRef.current) return;
    const sim = simulationRef.current;
    const chargeStrength = -100 - (spacing * 5);
    const linkDist = 40 + (edgeLength * 3);
    sim.force("charge", d3.forceManyBody().strength(chargeStrength));
    const linkForce = sim.force("link") as d3.ForceLink<GraphNode, any>;
    if (linkForce) linkForce.distance(linkDist);
    sim.alpha(0.5).restart();
  }, [spacing, edgeLength]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll("*").remove();

    const defs = svg.append("defs");

    // Arrows for base edge types
    Object.entries(BASE_EDGE_COLORS).forEach(([type, color]) => {
      defs
        .append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    });

    // Arrows for dependency types
    Object.entries(DEPENDENCY_COLOR_MAP).forEach(([type, color]) => {
      defs
        .append("marker")
        .attr("id", `arrow-dep-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    });

    // Journey arrow marker
    defs
      .append("marker")
      .attr("id", "arrow-journey")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", JOURNEY_COLOR);

    const g = svg.append("g");
    gRef.current = g;

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    zoomRef.current = zoom;
    svg.call(zoom);

    svg.on("click", (event: MouseEvent) => {
      if (event.target === svgRef.current) {
        onBackgroundClick();
      }
    });

    const simNodes: GraphNode[] = filteredNodes.map((n) => ({ ...n }));
    const simEdges: GraphEdge[] = filteredEdges.map((e) => ({
      ...e,
      source: typeof e.source === "string" ? e.source : e.source.id,
      target: typeof e.target === "string" ? e.target : e.target.id,
    }));

    const chargeStrength = -100 - (spacing * 5);
    const linkDist = 40 + (edgeLength * 3);

    const simulation = d3
      .forceSimulation<GraphNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, any>(simEdges)
          .id((d: any) => d.id)
          .distance(linkDist)
      )
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => getNodeRadius(d) + 4));

    simulationRef.current = simulation;

    const link = g
      .append("g")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", (d: any) => getEdgeColor(d))
      .attr("stroke-width", (d: any) => getEdgeWidth(d))
      .attr("marker-end", (d: any) => {
        if (d.type === "depends_on" && d.primary_dependency_type) {
          return `url(#arrow-dep-${d.primary_dependency_type})`;
        }
        return `url(#arrow-${d.type})`;
      })
      .attr("opacity", 0.7)
      .style("cursor", "pointer");

    link
      .on("click", (event: MouseEvent, d: any) => {
        event.stopPropagation();
        onEdgeSelect(d);
        onNodeSelect(null);
      })
      .on("mouseenter", (event: MouseEvent, d: any) => {
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 10,
          content: (
            <div>
              {d.type === "depends_on" && d.dependencies ? (
                <>
                  <div className="font-semibold text-foreground">Dependencies</div>
                  {d.dependencies.slice(0, 3).map((dep: any, i: number) => (
                    <div key={i} className="text-xs mt-1">
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: DEPENDENCY_COLOR_MAP[dep.dependency_type as DependencyType] }} />
                      <span className="text-muted-foreground">{dep.reason}</span>
                    </div>
                  ))}
                  {d.dependencies.length > 3 && (
                    <div className="text-xs text-muted-foreground mt-1">+{d.dependencies.length - 3} more</div>
                  )}
                </>
              ) : (
                <div className="font-semibold text-foreground capitalize">{d.type.replace(/_/g, " ")}</div>
              )}
            </div>
          ),
        });
      })
      .on("mouseleave", () => setTooltip(null));

    const nodeGroup = g.append("g");

    const circles = nodeGroup
      .selectAll("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", (d) => getNodeRadius(d))
      .attr("fill", (d) => getNodeColor(d))
      .attr("stroke", "hsl(0,0%,100%)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d) => d.phase === "Retired" ? "3,2" : null)
      .attr("opacity", (d) => d.phase === "Retired" ? 0.5 : 1)
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    circles
      .on("mouseenter", (event: MouseEvent, d: GraphNode) => {
        const rect = svgRef.current!.getBoundingClientRect();
        // Journey-specific tooltip
        const journeySteps = activeJourney ? journeyStepMap.get(d.id) : null;
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 10,
          content: (
            <div>
              <div className="font-semibold text-foreground">{d.name}</div>
              <div className="text-xs text-muted-foreground capitalize flex items-center gap-1.5">
                {d.type === "service" ? "Service" : (d.org_type || d.type).replace(/_/g, " ")}
                {d.phase === "Retired" && (
                  <span className="text-xs bg-muted text-muted-foreground px-1 py-0.5 rounded font-semibold uppercase tracking-wide">Retired</span>
                )}
              </div>
              {d.staff_count && (
                <div className="text-xs text-muted-foreground">{d.staff_count.toLocaleString()} staff</div>
              )}
              {journeySteps && journeySteps.length > 0 && (
                <div className="mt-1 border-t border-border pt-1">
                  {journeySteps.map((s) => {
                    const step = activeJourney!.steps.find((st) => st.step === s);
                    return (
                      <div key={s} className="text-xs" style={{ color: JOURNEY_COLOR }}>
                        Step {s}: {step?.action}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ),
        });
      })
      .on("mouseleave", () => setTooltip(null))
      .on("click", (_event: MouseEvent, d: GraphNode) => {
        onEdgeSelect(null);
        onNodeSelect(selectedNode?.id === d.id ? null : d);
      });

    // Labels for departments
    const labels = g
      .append("g")
      .selectAll("text")
      .data(simNodes.filter((n) => n.type === "organisation" && n.org_type === "department"))
      .join("text")
      .text((d) => d.name.length > 16 ? d.name.substring(0, 14) + "…" : d.name)
      .attr("font-size", 9)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => getNodeRadius(d) + 12)
      .attr("fill", "hsl(210, 24%, 16%)")
      .attr("pointer-events", "none")
      .style("font-family", "'Source Sans 3', sans-serif")
      .style("font-weight", "600");

    // ---- Policy overlap overlay layer ----
    g.append("g").attr("class", "policy-overlap-edges");

    // ---- Journey overlay layer ----
    const journeyEdgeGroup = g.append("g").attr("class", "journey-edges");
    const journeyBadgeGroup = g.append("g").attr("class", "journey-badges");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      circles.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
      labels.attr("x", (d) => d.x!).attr("y", (d) => d.y!);

      // Update policy overlap edge positions
      g.select(".policy-overlap-edges").selectAll("line").each(function (d: any) {
        const fromNode = simNodes.find((n) => n.id === d.source);
        const toNode = simNodes.find((n) => n.id === d.target);
        if (fromNode && toNode) {
          d3.select(this)
            .attr("x1", fromNode.x!)
            .attr("y1", fromNode.y!)
            .attr("x2", toNode.x!)
            .attr("y2", toNode.y!);
        }
      });

      // Update journey edges positions
      journeyEdgeGroup.selectAll("line").each(function (d: any) {
        const fromNode = simNodes.find((n) => n.id === d.from_org);
        const toNode = simNodes.find((n) => n.id === d.to_org);
        if (fromNode && toNode) {
          d3.select(this)
            .attr("x1", fromNode.x!)
            .attr("y1", fromNode.y!)
            .attr("x2", toNode.x!)
            .attr("y2", toNode.y!);
        }
      });

      // Update journey badges positions
      journeyBadgeGroup.selectAll("g.journey-badge").each(function (d: any) {
        const node = simNodes.find((n) => n.id === d.orgId);
        if (node) {
          const r = getNodeRadius(node);
          d3.select(this).attr("transform", `translate(${node.x! + r - 2}, ${node.y! - r - 4})`);
        }
      });
    });

    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(0.9));

    return () => { simulation.stop(); };
  }, [filteredNodes.length, filteredEdges.length, showServices, showOrganisations, JSON.stringify(edgeFilters), JSON.stringify(depFilters), onBackgroundClick]);

  // Update journey overlay when activeJourney changes (separate from main effect to avoid re-creating simulation)
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !simulationRef.current) return;
    const g = gRef.current;
    const simNodes = simulationRef.current.nodes();

    // Clear previous journey overlays
    g.selectAll(".journey-edges").selectAll("*").remove();
    g.selectAll(".journey-badges").selectAll("*").remove();

    if (!activeJourney) return;

    const journeyEdgeGroup = g.select(".journey-edges");
    const journeyBadgeGroup = g.select(".journey-badges");

    // Draw journey handoff edges
    const handoffEdges = activeJourney.handoff_edges;
    journeyEdgeGroup
      .selectAll("line")
      .data(handoffEdges)
      .join("line")
      .attr("stroke", JOURNEY_COLOR)
      .attr("stroke-width", 3)
      .attr("marker-end", "url(#arrow-journey)")
      .attr("opacity", 0.9)
      .attr("stroke-dasharray", "8 4")
      .style("animation", "journey-dash 1s linear infinite")
      .style("cursor", "pointer")
      .each(function (d: any) {
        const fromNode = simNodes.find((n: any) => n.id === d.from_org);
        const toNode = simNodes.find((n: any) => n.id === d.to_org);
        if (fromNode && toNode) {
          d3.select(this)
            .attr("x1", fromNode.x!)
            .attr("y1", fromNode.y!)
            .attr("x2", toNode.x!)
            .attr("y2", toNode.y!);
        }
      })
      .on("mouseenter", function (event: MouseEvent, d: any) {
        const rect = svgRef.current!.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 10,
          content: (
            <div>
              <div className="text-xs text-foreground font-semibold">{d.from_action}</div>
              <div className="text-xs text-muted-foreground">→ {d.to_action}</div>
              <div className="text-xs mt-1" style={{ color: d.is_mandatory ? JOURNEY_COLOR : "#d97706" }}>
                {d.is_mandatory ? "Mandatory" : "Optional"}
              </div>
            </div>
          ),
        });
      })
      .on("mouseleave", () => setTooltip(null));

    // Draw step number badges
    const badgeData: { orgId: string; step: number }[] = [];
    const seenOrgs = new Set<string>();
    for (const step of activeJourney.steps) {
      for (const org of step.organisations) {
        if (!seenOrgs.has(org.id)) {
          seenOrgs.add(org.id);
          badgeData.push({ orgId: org.id, step: step.step });
        }
      }
    }

    const badges = journeyBadgeGroup
      .selectAll("g.journey-badge")
      .data(badgeData)
      .join("g")
      .attr("class", "journey-badge")
      .each(function (d: any) {
        const node = simNodes.find((n: any) => n.id === d.orgId);
        if (node) {
          const r = getNodeRadius(node as GraphNode);
          d3.select(this).attr("transform", `translate(${node.x! + r - 2}, ${node.y! - r - 4})`);
        }
      });

    badges
      .append("circle")
      .attr("r", 7)
      .attr("fill", JOURNEY_COLOR)
      .attr("stroke", "white")
      .attr("stroke-width", 1.5);

    badges
      .append("text")
      .text((d: any) => d.step)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "white")
      .attr("font-size", 8)
      .attr("font-weight", "700")
      .attr("pointer-events", "none");

  }, [activeJourney]);

  // Policy overlap overlay
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !simulationRef.current) return;
    const g = gRef.current;
    const simNodes = simulationRef.current.nodes();

    g.select(".policy-overlap-edges").selectAll("*").remove();
    if (!showPolicyOverlap) return;

    const edgesToShow = activePolicyTopic
      ? policyOverlapEdges.filter((e) => e.topics.some((t) => t.topic === activePolicyTopic))
      : policyOverlapEdges;

    const policyGroup = g.select(".policy-overlap-edges");

    policyGroup
      .selectAll("line")
      .data(edgesToShow)
      .join("line")
      .attr("stroke", POLICY_OVERLAP_COLOR)
      .attr("stroke-width", (d) => Math.max(1, 1 + Math.log2(d.total_score / 10)))
      .attr("stroke-dasharray", "5,3")
      .attr("opacity", 0.65)
      .style("cursor", "pointer")
      .each(function (d) {
        const fromNode = simNodes.find((n) => n.id === d.source);
        const toNode = simNodes.find((n) => n.id === d.target);
        if (fromNode && toNode) {
          d3.select(this)
            .attr("x1", fromNode.x ?? 0)
            .attr("y1", fromNode.y ?? 0)
            .attr("x2", toNode.x ?? 0)
            .attr("y2", toNode.y ?? 0);
        }
      })
      .on("mouseenter", function (event: MouseEvent, d) {
        const rect = svgRef.current!.getBoundingClientRect();
        const topTopics = d.topics.slice(0, 4);
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 10,
          content: (
            <div>
              <div className="font-semibold text-foreground mb-1">Policy overlap</div>
              {topTopics.map((t) => (
                <div key={t.topic} className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: POLICY_OVERLAP_COLOR }} />
                  {t.topic}
                  <span className="ml-auto text-foreground/60">{t.score}</span>
                </div>
              ))}
              {d.topics.length > 4 && (
                <div className="text-xs text-muted-foreground mt-1">+{d.topics.length - 4} more topics</div>
              )}
            </div>
          ),
        });
      })
      .on("mouseleave", () => setTooltip(null));

  }, [showPolicyOverlap, activePolicyTopic, policyOverlapEdges]);

  // Update opacity based on selection, search, and journey
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll("circle").attr("opacity", (d: any) => {
      if (activeJourney) {
        return journeyNodeIds.has(d.id) ? 1 : 0.3;
      }
      if (policyTopicOrgIds) {
        return policyTopicOrgIds.has(d.id) ? 1 : 0.1;
      }
      const match = searchMatch(d);
      const connected = isConnected(d.id);
      if (!match && searchTerm) return 0.1;
      if (!connected) return 0.15;
      return 1;
    });

    // Node rings: journey highlight or policy topic highlight
    svg.selectAll("circle").attr("stroke", (d: any) => {
      if (activeJourney && journeyNodeIds.has(d.id)) return JOURNEY_COLOR;
      if (policyTopicOrgIds && policyTopicOrgIds.has(d.id)) return POLICY_OVERLAP_COLOR;
      return "hsl(0,0%,100%)";
    }).attr("stroke-width", (d: any) => {
      if (activeJourney && journeyNodeIds.has(d.id)) return 2.5;
      if (policyTopicOrgIds && policyTopicOrgIds.has(d.id)) return 2.5;
      return 1.5;
    });

    svg.selectAll("line").attr("opacity", (d: any) => {
      if (d.from_org) return 0.9; // journey edge, keep visible
      if (d.source && d.target && !d.type) return 0.65; // policy overlap edge
      if (activeJourney) return 0.15;
      if (policyTopicOrgIds) return 0.1; // dim structural edges when topic active
      if (!selectedNode) return 0.7;
      const s = typeof d.source === "string" ? d.source : d.source.id;
      const t = typeof d.target === "string" ? d.target : d.target.id;
      if (s === selectedNode.id || t === selectedNode.id) return 1;
      return 0.08;
    });

    svg.selectAll("text").attr("opacity", (d: any) => {
      if (!d?.id) return 1;
      if (activeJourney) {
        return journeyNodeIds.has(d.id) ? 1 : 0.3;
      }
      if (policyTopicOrgIds) {
        return policyTopicOrgIds.has(d.id) ? 1 : 0.1;
      }
      const connected = isConnected(d.id);
      if (!connected) return 0.15;
      return 1;
    });
  }, [selectedNode, searchTerm, searchMatch, isConnected, activeJourney, journeyNodeIds, policyTopicOrgIds]);

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full bg-background" />
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 bg-card border border-border rounded px-3 py-2 shadow-lg max-w-xs"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
});

NetworkGraph.displayName = "NetworkGraph";
export default NetworkGraph;
