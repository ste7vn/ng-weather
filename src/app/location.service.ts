import { Injectable, signal } from "@angular/core";
import { WeatherService } from "./weather.service";
import { BehaviorSubject } from "rxjs";

export const LOCATIONS: string = "locations";

@Injectable()
export class LocationService {
  private _locations = new BehaviorSubject<string[]>([]);
  public locations = this._locations.asObservable();

  constructor() {
    let locString = localStorage.getItem(LOCATIONS);
    if (locString) this._locations.next(JSON.parse(locString));
  }

  addLocation(zipcode: string) {
    const current = this._locations.value;
    if (current.indexOf(zipcode) !== -1) return; // no duplicates
    this._locations.next([...current, zipcode]);
    localStorage.setItem(LOCATIONS, JSON.stringify(this._locations.value));
  }

  removeLocation(zipcode: string) {
    const current = this._locations.value;
    let index = current.indexOf(zipcode);
    if (index !== -1) {
      this._locations.next([
        ...current.slice(0, index),
        ...current.slice(index + 1),
      ]);
      localStorage.setItem(LOCATIONS, JSON.stringify(this._locations.value));
    }
  }

  removeLocations(zipcodes: string[]) {
    const updated = this._locations.value.filter(
      (location) => zipcodes.indexOf(location) === -1
    );
    if (updated.length !== this._locations.value.length) {
      this._locations.next(updated);
      localStorage.setItem(LOCATIONS, JSON.stringify(this._locations.value));
    }
  }
}
