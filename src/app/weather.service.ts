import { Injectable, Signal, inject, signal } from "@angular/core";
import { Observable, Subject, forkJoin, of, zip } from "rxjs";
import {
  catchError,
  finalize,
  map,
  mergeMap,
  switchMap,
  takeUntil,
} from "rxjs/operators";

import { HttpClient } from "@angular/common/http";
import { CurrentConditions } from "./current-conditions/current-conditions.type";
import { ConditionsAndZip } from "./conditions-and-zip.type";
import { Forecast } from "./forecasts-list/forecast.type";
import { LocationService } from "./location.service";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { ToastrService } from "ngx-toastr";

@Injectable()
export class WeatherService {
  static URL = "http://api.openweathermap.org/data/2.5";
  static APPID = "5a4b2d457ecbef9eb2a71e480b947604";
  static ICON_URL =
    "https://raw.githubusercontent.com/udacity/Sunshine-Version-2/sunshine_master/app/src/main/res/drawable-hdpi/";
  private currentConditions = signal<ConditionsAndZip[]>([]);
  /**
   * Map which holds the zipcode of each request and the subject to cancel the request
   */
  private _queue = new Map<string, Subject<void>>();

  constructor(
    private http: HttpClient,
    private locationService: LocationService,
    private toastr: ToastrService
  ) {
    this.locationService.locations
      .pipe(
        mergeMap((locations) => this._locationsToConditions(locations)),
        takeUntilDestroyed() // safe since we are within the main injection context
      )
      .subscribe((locations) => {
        this.currentConditions.set(
          locations.filter((c) => c.data !== undefined)
        );
        const error = locations.filter((c) => c.data === undefined);
        this._cancel(error);
        if (error.length) {
          // removing any location that gave error
          this.locationService.removeLocations(error.map((loc) => loc.zip));
        }
      });
  }
  /**
   * Maps the locations to multiple conditions observables
   * @param locations
   * @returns
   */
  private _locationsToConditions(
    locations: string[]
  ): Observable<ConditionsAndZip[]> {
    const current = this.currentConditions();
    const toReplay: string[] = [];
    const toAdd: string[] = [];
    for (const loc of locations) {
      if (current.findIndex((c) => c.zip === loc) === -1) {
        toAdd.push(loc);
      } else {
        toReplay.push(loc);
      }
    }
    const obs$: Observable<ConditionsAndZip>[] = [];

    for (const loc of toReplay) {
      // replay the current conditions avoiding making a new request
      obs$.push(
        this._queueRequest(loc, of(current.find((c) => c.zip === loc)))
      );
    }

    for (const loc of toAdd) {
      obs$.push(this._queueRequest(loc, this._getConditions(loc)));
    }

    // others should be unsubscribed since request could still be alive or actually never requested
    const toBeCanceled = current.filter((c) => toReplay.indexOf(c.zip) === -1);
    this._cancel(toBeCanceled);
    if (obs$.length === 0) return of([]);

    return forkJoin(obs$);
  }
  /**
   * Returns a request which gets queued and can be canceled later
   */
  private _queueRequest(
    zip: string,
    request: Observable<ConditionsAndZip>
  ): Observable<ConditionsAndZip> {
    const cancel$ = new Subject<void>();
    this._queue.set(zip, cancel$);
    return request.pipe(
      takeUntil(cancel$),
      finalize(() => this._queue.delete(zip))
    );
  }
  /**
   * Cancels any ongoing request for the given conditions
   */
  private _cancel(conditions: ConditionsAndZip[]) {
    for (const condition of conditions) {
      // cancel the request if still ongoing
      const cancel$ = this._queue.get(condition.zip);
      if (cancel$) {
        cancel$.next();
        this._queue.delete(condition.zip);
      }
    }
  }
  /**
   * Makes http request to get the current conditions
   * @param zipcode Location to get the conditions
   */
  private _getConditions(zipcode: string): Observable<ConditionsAndZip> {
    return this.http
      .get<CurrentConditions>(
        `${WeatherService.URL}/weather?zip=${zipcode},us&units=imperial&APPID=${WeatherService.APPID}`
      )
      .pipe(
        catchError((err) => {
          if (err.status === 404)
            this.toastr.error(`Location ${zipcode} not found`, "Error");
          else
            this.toastr.error(
              `An error occurred while loading ${zipcode} location`,
              "Error"
            );
          return of(undefined);
        }),
        map((data) => ({ zip: zipcode, data }))
      );
  }

  getCurrentConditions(): Signal<ConditionsAndZip[]> {
    return this.currentConditions.asReadonly();
  }

  getForecast(zipcode: string): Observable<Forecast> {
    // Here we make a request to get the forecast data from the API. Note the use of backticks and an expression to insert the zipcode
    return this.http.get<Forecast>(
      `${WeatherService.URL}/forecast/daily?zip=${zipcode},us&units=imperial&cnt=5&APPID=${WeatherService.APPID}`
    );
  }

  getWeatherIcon(id): string {
    if (id >= 200 && id <= 232)
      return WeatherService.ICON_URL + "art_storm.png";
    else if (id >= 501 && id <= 511)
      return WeatherService.ICON_URL + "art_rain.png";
    else if (id === 500 || (id >= 520 && id <= 531))
      return WeatherService.ICON_URL + "art_light_rain.png";
    else if (id >= 600 && id <= 622)
      return WeatherService.ICON_URL + "art_snow.png";
    else if (id >= 801 && id <= 804)
      return WeatherService.ICON_URL + "art_clouds.png";
    else if (id === 741 || id === 761)
      return WeatherService.ICON_URL + "art_fog.png";
    else return WeatherService.ICON_URL + "art_clear.png";
  }
}
