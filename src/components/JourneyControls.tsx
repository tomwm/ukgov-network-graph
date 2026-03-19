import type { Journey } from "@/types/journey";

interface JourneyControlsProps {
  journeys: Journey[];
  journeyEnabled: boolean;
  onJourneyEnabledChange: (value: boolean) => void;
  selectedJourneyId: string | null;
  onSelectedJourneyChange: (id: string | null) => void;
}

export default function JourneyControls({
  journeys,
  journeyEnabled,
  onJourneyEnabledChange,
  selectedJourneyId,
  onSelectedJourneyChange,
}: JourneyControlsProps) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Citizen Journeys
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            checked={journeyEnabled}
            onChange={(e) => onJourneyEnabledChange(e.target.checked)}
            className="rounded border-input"
            style={{ accentColor: "#06b6d4" }}
          />
          Show journey
        </label>
        <select
          disabled={!journeyEnabled}
          value={selectedJourneyId || ""}
          onChange={(e) => onSelectedJourneyChange(e.target.value || null)}
          className="w-full py-1.5 px-2 text-sm bg-background border border-input rounded disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select a journey…</option>
          {journeys.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
