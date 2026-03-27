import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import NetworkGraph from "@/components/NetworkGraph";
import type { NetworkGraphHandle } from "@/components/NetworkGraph";
import GraphControls from "@/components/GraphControls";
import NodeInfoPanel from "@/components/NodeInfoPanel";
import JourneyDetailPanel from "@/components/JourneyDetailPanel";
import { buildGraphData } from "@/lib/buildGraphData";
import { loadJourneys } from "@/lib/loadJourneys";
import type { GraphNode, GraphEdge, DependencyType, PolicyOverlapEdge } from "@/types/graph";
import type { Journey } from "@/types/journey";

const DEFAULT_DEP_FILTERS: Record<DependencyType, boolean> = {
  shared_service: true,
  data_sharing: true,
  platform: true,
  regulatory: true,
  operational: true,
  financial: false,
};

const Index = () => {
  const data = useMemo(() => buildGraphData(), []);
  const journeys = useMemo(() => loadJourneys(), []);
  const graphRef = useRef<NetworkGraphHandle>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [edgeFilters, setEdgeFilters] = useState({
    works_with: true,
    runs_service: true,
  });
  const [depFilters, setDepFilters] = useState<Record<DependencyType, boolean>>(DEFAULT_DEP_FILTERS);
  const [showServices, setShowServices] = useState(true);
  const [showOrganisations, setShowOrganisations] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [selectedPolicyEdge, setSelectedPolicyEdge] = useState<PolicyOverlapEdge | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [spacing, setSpacing] = useState(40);
  const [edgeLength, setEdgeLength] = useState(20);

  // Journey state
  const [journeyEnabled, setJourneyEnabled] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);

  // Policy overlap state
  const [showPolicyOverlap, setShowPolicyOverlap] = useState(false);
  const [activePolicyTopic, setActivePolicyTopic] = useState<string | null>(null);

  const policyTopics = useMemo(() => Object.keys(data.policyTopicIndex).sort(), [data.policyTopicIndex]);

  const policyTopicOrgIds = useMemo(() => {
    if (!activePolicyTopic) return null;
    const orgs = data.policyTopicIndex[activePolicyTopic] || [];
    return new Set(orgs.map((o) => o.slug));
  }, [activePolicyTopic, data.policyTopicIndex]);

  const activeJourney: Journey | null = useMemo(() => {
    if (!journeyEnabled || !selectedJourneyId) return null;
    return journeys.find((j) => j.id === selectedJourneyId) || null;
  }, [journeyEnabled, selectedJourneyId, journeys]);

  // Center graph on first matching node when search changes
  useEffect(() => {
    if (!searchTerm || !graphRef.current) return;
    const term = searchTerm.toLowerCase();
    let matchId: string | undefined;
    for (const [alias, id] of data.aliasMap) {
      if (alias.includes(term)) { matchId = id; break; }
    }
    if (!matchId) {
      const found = data.nodes.find((n) => n.name.toLowerCase().includes(term));
      matchId = found?.id;
    }
    if (matchId) {
      const timer = setTimeout(() => graphRef.current?.centerOnNode(matchId!), 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, data]);

  const handleEdgeFilterChange = (type: string, value: boolean) => {
    setEdgeFilters((prev) => ({ ...prev, [type]: value }));
  };

  const handleDepFilterChange = (type: DependencyType, value: boolean) => {
    setDepFilters((prev) => ({ ...prev, [type]: value }));
  };

  const handleDepAllToggle = (value: boolean) => {
    setDepFilters((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as DependencyType[]) {
        next[key] = value;
      }
      return next;
    });
  };

  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setSelectedPolicyEdge(null);
    if (node) setPanelOpen(true);
  }, []);

  const handleEdgeSelect = useCallback((edge: GraphEdge | null) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setSelectedPolicyEdge(null);
    if (edge) setPanelOpen(true);
  }, []);

  const handlePolicyEdgeSelect = useCallback((edge: PolicyOverlapEdge) => {
    setSelectedPolicyEdge(edge);
    setSelectedNode(null);
    setSelectedEdge(null);
    setPanelOpen(true);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedPolicyEdge(null);
  }, []);

  const handleResetLayout = useCallback(() => {
    setSpacing(40);
    setEdgeLength(20);
    graphRef.current?.resetLayout();
  }, []);

  const handleJourneyClose = useCallback(() => {
    setJourneyEnabled(false);
    setSelectedJourneyId(null);
  }, []);

  const handleJourneyOrgClick = useCallback((orgId: string) => {
    graphRef.current?.centerOnNode(orgId);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex-shrink-0 bg-foreground px-6 py-3">
        <h1 className="text-lg font-bold text-background tracking-tight">
          UK Government Network Graph
        </h1>
        <p className="text-xs text-muted mt-0.5">
          Organisations, services and operational dependencies across government
        </p>
      </header>

      <div className="flex-shrink-0 bg-accent/10 border-b border-accent px-6 py-2 flex items-center gap-2">
        <span className="inline-block bg-accent text-accent-foreground text-xs font-bold uppercase px-2 py-0.5 rounded-sm">
          Alpha
        </span>
        <span className="text-xs text-foreground">
          This is a prototype, all information is representative only.
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex-shrink-0 w-64 border-r border-border overflow-y-auto p-0">
          <GraphControls
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            edgeFilters={edgeFilters}
            onEdgeFilterChange={handleEdgeFilterChange}
            depFilters={depFilters}
            onDepFilterChange={handleDepFilterChange}
            onDepAllToggle={handleDepAllToggle}
            showServices={showServices}
            onShowServicesChange={setShowServices}
            showOrganisations={showOrganisations}
            onShowOrganisationsChange={setShowOrganisations}
            spacing={spacing}
            onSpacingChange={setSpacing}
            edgeLength={edgeLength}
            onEdgeLengthChange={setEdgeLength}
            onResetLayout={handleResetLayout}
            journeys={journeys}
            journeyEnabled={journeyEnabled}
            onJourneyEnabledChange={setJourneyEnabled}
            selectedJourneyId={selectedJourneyId}
            onSelectedJourneyChange={setSelectedJourneyId}
            activeJourney={activeJourney}
            showPolicyOverlap={showPolicyOverlap}
            onShowPolicyOverlapChange={setShowPolicyOverlap}
            policyTopics={policyTopics}
            activePolicyTopic={activePolicyTopic}
            onPolicyTopicChange={setActivePolicyTopic}
          />
        </aside>

        <main className="flex-1 relative min-w-0">
          <NetworkGraph
            ref={graphRef}
            nodes={data.nodes}
            edges={data.edges}
            edgeFilters={edgeFilters}
            depFilters={depFilters}
            showServices={showServices}
            showOrganisations={showOrganisations}
            searchTerm={searchTerm}
            aliasMap={data.aliasMap}
            onNodeSelect={handleNodeSelect}
            onEdgeSelect={handleEdgeSelect}
            onBackgroundClick={handleBackgroundClick}
            selectedNode={selectedNode}
            spacing={spacing}
            edgeLength={edgeLength}
            activeJourney={activeJourney}
            policyOverlapEdges={data.policyOverlapEdges}
            showPolicyOverlap={showPolicyOverlap}
            activePolicyTopic={activePolicyTopic}
            policyTopicOrgIds={policyTopicOrgIds}
            onPolicyEdgeSelect={handlePolicyEdgeSelect}
          />
        </main>

        {activeJourney ? (
          <div className="flex-shrink-0 w-[360px] bg-card border-l border-border overflow-hidden">
            <JourneyDetailPanel
              journey={activeJourney}
              onClose={handleJourneyClose}
              onOrgClick={handleJourneyOrgClick}
            />
          </div>
        ) : (
          <NodeInfoPanel
            node={selectedNode}
            selectedEdge={selectedEdge}
            selectedPolicyEdge={selectedPolicyEdge}
            edges={data.edges}
            nodes={data.nodes}
            isOpen={panelOpen}
            onClose={() => { setPanelOpen(false); setSelectedNode(null); setSelectedEdge(null); setSelectedPolicyEdge(null); }}
            onToggle={() => setPanelOpen(true)}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
