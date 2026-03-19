import journeyData from "@/data/uk_gov_citizen_journeys.json";
import type { Journey } from "@/types/journey";

export function loadJourneys(): Journey[] {
  const data = journeyData as any;
  return data.journeys || [];
}
