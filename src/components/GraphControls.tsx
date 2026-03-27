import { Search, X, ChevronDown, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { DEPENDENCY_TYPES, type DependencyType } from "@/types/graph";
import type { Journey } from "@/types/journey";
import JourneyControls from "@/components/JourneyControls";

interface GraphControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  edgeFilters: { works_with: boolean; runs_service: boolean };
  onEdgeFilterChange: (type: string, value: boolean) => void;
  depFilters: Record<DependencyType, boolean>;
  onDepFilterChange: (type: DependencyType, value: boolean) => void;
  onDepAllToggle: (value: boolean) => void;
  showServices: boolean;
  onShowServicesChange: (value: boolean) => void;
  showOrganisations: boolean;
  onShowOrganisationsChange: (value: boolean) => void;
  showAllLabels: boolean;
  onShowAllLabelsChange: (value: boolean) => void;
  spacing: number;
  onSpacingChange: (value: number) => void;
  edgeLength: number;
  onEdgeLengthChange: (value: number) => void;
  onResetLayout: () => void;
  journeys: Journey[];
  journeyEnabled: boolean;
  onJourneyEnabledChange: (value: boolean) => void;
  selectedJourneyId: string | null;
  onSelectedJourneyChange: (id: string | null) => void;
  activeJourney: Journey | null;
  showPolicyOverlap: boolean;
  onShowPolicyOverlapChange: (value: boolean) => void;
  policyTopics: string[];
  activePolicyTopic: string | null;
  onPolicyTopicChange: (topic: string | null) => void;
}

export default function GraphControls({
  searchTerm,
  onSearchChange,
  edgeFilters,
  onEdgeFilterChange,
  depFilters,
  onDepFilterChange,
  onDepAllToggle,
  showServices,
  onShowServicesChange,
  showOrganisations,
  onShowOrganisationsChange,
  showAllLabels,
  onShowAllLabelsChange,
  spacing,
  onSpacingChange,
  edgeLength,
  onEdgeLengthChange,
  onResetLayout,
  journeys,
  journeyEnabled,
  onJourneyEnabledChange,
  selectedJourneyId,
  onSelectedJourneyChange,
  activeJourney,
  showPolicyOverlap,
  onShowPolicyOverlapChange,
  policyTopics,
  activePolicyTopic,
  onPolicyTopicChange,
}: GraphControlsProps) {
  const [layoutOpen, setLayoutOpen] = useState(true);

  const allDepsOn = DEPENDENCY_TYPES.every((d) => depFilters[d.type]);
  const allDepsOff = DEPENDENCY_TYPES.every((d) => !depFilters[d.type]);
  const masterState: "all" | "none" | "indeterminate" = allDepsOn
    ? "all"
    : allDepsOff
    ? "none"
    : "indeterminate";

  return (
    <div className="flex flex-col gap-4 p-4 bg-card border border-border rounded shadow-sm">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search…"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm bg-background border border-input rounded placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nodes */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Nodes
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              checked={showOrganisations}
              onChange={(e) => onShowOrganisationsChange(e.target.checked)}
              className="rounded border-input"
              style={{ accentColor: "hsl(213, 72%, 30%)" }}
            />
            Show organisations
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              checked={showServices}
              onChange={(e) => onShowServicesChange(e.target.checked)}
              className="rounded border-input"
              style={{ accentColor: "hsl(164, 60%, 40%)" }}
            />
            Show services
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              checked={showAllLabels}
              onChange={(e) => onShowAllLabelsChange(e.target.checked)}
              className="rounded border-input"
            />
            Show all labels
          </label>
        </div>
      </div>

      {/* Relationships */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Relationships
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              checked={edgeFilters.works_with}
              onChange={(e) => onEdgeFilterChange("works_with", e.target.checked)}
              className="rounded border-input"
              style={{ accentColor: "hsl(210, 10%, 65%)" }}
            />
            Works with
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              checked={edgeFilters.runs_service}
              onChange={(e) => onEdgeFilterChange("runs_service", e.target.checked)}
              className="rounded border-input"
              style={{ accentColor: "hsl(200, 70%, 60%)" }}
            />
            Runs service
          </label>
        </div>
      </div>

      {/* Dependencies */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Dependencies
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground font-semibold">
            <span className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={masterState === "all"}
                ref={(el) => {
                  if (el) el.indeterminate = masterState === "indeterminate";
                }}
                onChange={() => onDepAllToggle(masterState !== "all")}
                className="rounded border-input accent-primary"
              />
            </span>
            All dependencies
          </label>
          {DEPENDENCY_TYPES.map(({ type, label, color }) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer text-sm text-foreground pl-4">
              <input
                type="checkbox"
                checked={depFilters[type]}
                onChange={(e) => onDepFilterChange(type, e.target.checked)}
                className="rounded border-input"
                style={{ accentColor: color }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Policy Topics */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Policy Topics
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input
              type="checkbox"
              checked={showPolicyOverlap}
              onChange={(e) => onShowPolicyOverlapChange(e.target.checked)}
              className="rounded border-input"
              style={{ accentColor: "hsl(38, 90%, 55%)" }}
            />
            Show policy overlap
          </label>
          <select
            disabled={!showPolicyOverlap}
            value={activePolicyTopic || ""}
            onChange={(e) => onPolicyTopicChange(e.target.value || null)}
            className="w-full py-1.5 px-2 text-sm bg-background border border-input rounded disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All topics</option>
            {policyTopics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Citizen Journeys */}
      <JourneyControls
        journeys={journeys}
        journeyEnabled={journeyEnabled}
        onJourneyEnabledChange={onJourneyEnabledChange}
        selectedJourneyId={selectedJourneyId}
        onSelectedJourneyChange={onSelectedJourneyChange}
      />

      {/* Layout controls */}
      <Collapsible open={layoutOpen} onOpenChange={setLayoutOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full group">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Layout
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${layoutOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 flex flex-col gap-4">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Compact</span>
              <span>Spacing</span>
              <span>Wide</span>
            </div>
            <Slider
              value={[spacing]}
              onValueChange={([v]) => onSpacingChange(v)}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Short</span>
              <span>Edge length</span>
              <span>Long</span>
            </div>
            <Slider
              value={[edgeLength]}
              onValueChange={([v]) => onEdgeLengthChange(v)}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <button
            onClick={onResetLayout}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset layout
          </button>
        </CollapsibleContent>
      </Collapsible>

      {/* Legend */}
      <div className="border-t border-border pt-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Legend</div>
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-node-department" />
            Department
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-node-agency" />
            Agency / ALB
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-node-regulator" />
            Independent body / regulator
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-node-service" />
            Service
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-6 border-t-2 border-edge-works-with" />
            Works with
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 border-t-2 border-edge-runs" />
            Runs service
          </div>
          {DEPENDENCY_TYPES.map(({ type, label, color }) => (
            <div key={type} className="flex items-center gap-2">
              <span className="w-6 border-t-2" style={{ borderColor: color }} />
              {label}
            </div>
          ))}
          {showPolicyOverlap && (
            <div className="flex items-center gap-2">
              <span className="w-6 border-t-2" style={{ borderColor: "hsl(38, 90%, 55%)", borderStyle: "dashed" }} />
              Policy overlap
            </div>
          )}
          {activeJourney && (
            <div className="flex items-center gap-2 mt-1">
              <svg width="24" height="12" className="flex-shrink-0">
                <defs>
                  <marker id="legend-journey-arrow" viewBox="0 -3 6 6" refX="5" refY="0" markerWidth="4" markerHeight="4" orient="auto">
                    <path d="M0,-3L6,0L0,3" fill="#06b6d4" />
                  </marker>
                </defs>
                <line x1="0" y1="6" x2="18" y2="6" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#legend-journey-arrow)" />
              </svg>
              Citizen journey path
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2 italic">
            Node size is proportional to staff count.
          </p>
          <p className="text-xs text-muted-foreground italic">
            Dependency edge thickness reflects total weight.
          </p>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border -mx-4">
        <p className="text-[10px] text-muted-foreground leading-snug font-semibold mb-1">Data sources</p>
        <ul className="text-[10px] text-muted-foreground leading-relaxed space-y-0.5">
          <li>
            <a href="https://www.gov.uk/government/organisations" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              GOV.UK Organisations
            </a>
          </li>
          <li>
            <a href="https://govuk-services-list.x-govuk.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              GOV.UK Services List
            </a>
          </li>
          <li>
            <a href="https://www.gov.uk/search/policy-papers-and-consultations" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              GOV.UK Publications
            </a>
            {" "}(policy overlap)
          </li>
          <li>
            <a href="https://www.gov.uk/government/collections/civil-service-statistics" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Civil Service Statistics
            </a>
            {" "}(staff numbers)
          </li>
          <li>
            <a href="https://www.gov.uk/browse" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              GOV.UK Step-by-step guides
            </a>
            {" "}(citizen journeys)
          </li>
        </ul>
      </div>
    </div>
  );
}
