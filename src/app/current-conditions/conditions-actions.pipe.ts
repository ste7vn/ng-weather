import { Pipe, PipeTransform } from "@angular/core";
import { LocationService } from "app/location.service";

@Pipe({
  name: "conditionsActions",
})
export class ConditionsActionsPipe implements PipeTransform {
  constructor(private _locationService: LocationService) {}
  transform(zipcode: string) {
    return [
      { icon: "x", action: () => this._locationService.removeLocation(zipcode) },
    ];
  }
}
