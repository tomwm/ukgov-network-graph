export interface JourneyOrg {
  name: string;
  id: string;
}

export interface JourneyStep {
  step: number;
  action: string;
  organisations: JourneyOrg[];
  services: string[];
  is_optional: boolean;
}

export interface HandoffEdge {
  from_org: string;
  to_org: string;
  from_step: number;
  to_step: number;
  from_action: string;
  to_action: string;
  is_mandatory: boolean;
}

export interface Journey {
  id: string;
  name: string;
  description: string;
  life_event: string;
  source: string;
  steps: JourneyStep[];
  handoff_edges: HandoffEdge[];
}

export interface JourneyData {
  metadata: any;
  journeys: Journey[];
}
