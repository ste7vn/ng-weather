import { Forecast } from "./forecasts-list/forecast.type";

export interface ForecastAndZip {
  zip: string;
  lastUpdate: number;
  data: Forecast;
}
