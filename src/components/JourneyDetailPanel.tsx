import { ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react";
import type { Journey } from "@/types/journey";

interface JourneyDetailPanelProps {
  journey: Journey;
  onClose: () => void;
  onOrgClick: (orgId: string) => void;
}

export default function JourneyDetailPanel({
  journey,
  onClose,
  onOrgClick,
}: JourneyDetailPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to graph
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h3 className="text-base font-bold text-foreground leading-tight flex items-center gap-2">
            <span>🗺️</span> {journey.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{journey.life_event}</p>
          <p className="text-sm text-foreground mt-2">{journey.description}</p>
        </div>

        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Steps
        </div>

        <div className="flex flex-col">
          {journey.steps.map((step, idx) => (
            <div key={step.step} className="flex gap-3">
              {/* Vertical line + step badge */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: "#06b6d4", color: "white" }}
                >
                  {step.step}
                </div>
                {idx < journey.steps.length - 1 && (
                  <div className="w-0.5 flex-1 min-h-[16px]" style={{ backgroundColor: "#06b6d4", opacity: 0.3 }} />
                )}
              </div>

              {/* Step content */}
              <div className="pb-4 min-w-0">
                <p className="text-sm text-foreground font-medium leading-snug">
                  {step.action}
                </p>
                {step.organisations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => onOrgClick(org.id)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <span>🏛</span> {org.name}
                  </button>
                ))}
                {step.services.map((svc) => (
                  <div key={svc} className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <span>📋</span> {svc}
                  </div>
                ))}
                {step.is_optional && (
                  <div className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    <AlertTriangle className="h-3 w-3" />
                    Optional
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {journey.source && (
          <div className="mt-4 pt-3 border-t border-border">
            <a
              href={journey.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Source: {journey.source.replace("https://www.gov.uk/", "gov.uk/")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
