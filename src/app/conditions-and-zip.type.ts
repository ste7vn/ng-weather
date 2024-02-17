import { CurrentConditions } from "./current-conditions/current-conditions.type";

export interface ConditionsAndZip {
  zip: string;
  lastUpdate: number;
  data: CurrentConditions;
}
