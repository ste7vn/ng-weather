import {
  Inject,
  Injectable,
  InjectionToken,
  Optional,
  Signal,
  WritableSignal,
  inject,
  signal,
} from "@angular/core";
import { Observable, Subject, forkJoin, of, zip } from "rxjs";
import {
  catchError,
  finalize,
  map,
  mergeMap,
  switchMap,
  takeUntil,
  tap,
} from "rxjs/operators";

import { HttpClient } from "@angular/common/http";
import { CurrentConditions } from "./current-conditions/current-conditions.type";
import { ConditionsAndZip } from "./conditions-and-zip.type";
import { Forecast } from "./forecasts-list/forecast.type";
import { LocationService } from "./location.service";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ToastrService } from "ngx-toastr";
import { ForecastAndZip } from "./forecast-and-zip.type";

const CONDITIONS_LS_KEY = "ng-weather-conditions_41163ad4";
const FORECASTS_LS_KEY = "ng-weather-forecasts_41163ad4";
/**
 * Indicates the duration in seconds to cache the current conditions
 */
export const CONDITIONS_CACHE_DURATION = new InjectionToken<number>(
  "weather.conditions.cache.duration"
);

@Injectable()
export class WeatherService {
  static URL = "https://api.openweathermap.org/data/2.5";
  static APPID = "5a4b2d457ecbef9eb2a71e480b947604";
  static ICON_URL =
    "https://raw.githubusercontent.com/udacity/Sunshine-Version-2/sunshine_master/app/src/main/res/drawable-hdpi/";
  private currentConditions: WritableSignal<ConditionsAndZip[]> = signal(
    this._readConditionsFromCache()
  );
  /**
   * Map which holds the zipcode of each request and the subject to cancel the request
   */
  private _queue = new Map<string, Subject<void>>();
  private _cacheDuration: number;

  constructor(
    @Optional()
    @Inject(CONDITIONS_CACHE_DURATION)
    _cacheDuration: number,
    private http: HttpClient,
    private locationService: LocationService,
    private toastr: ToastrService
  ) {
    this._cacheDuration = (_cacheDuration ?? 7200) * 1000; // default 2 hours

    this.locationService.locations
      .pipe(
        mergeMap((locations) => this._locationsToConditions(locations)),
        takeUntilDestroyed() // safe since we are within an injection context
      )
      .subscribe((locations) => {
        this.currentConditions.set(
          locations.filter((c) => c.data !== undefined)
        );
        // updating locations storage
        const error = locations.filter((c) => c.data === undefined);
        this._cancel(error);
        if (error.length) {
          // removing any location that gave error
          this.locationService.removeLocations(error.map((loc) => loc.zip));
        }
        // storing the current conditions in local storage
        this._storeConditionsToCache(this.currentConditions());
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
    const toRequest: string[] = [];
    for (const loc of locations) {
      const idx = current.findIndex((c) => c.zip === loc);
      if (
        idx === -1 || // not found
        current[idx].lastUpdate + this._cacheDuration < Date.now() // found but expired
      ) {
        toRequest.push(loc);
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

    for (const loc of toRequest) {
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
        map((data) => ({ zip: zipcode, data, lastUpdate: Date.now() }))
      );
  }

  getCurrentConditions(): Signal<ConditionsAndZip[]> {
    return this.currentConditions.asReadonly();
  }

  getForecast(zipcode: string): Observable<Forecast> {
    const cached = this._getForecastFromCache(zipcode);
    if (cached) return of(cached);
    // Here we make a request to get the forecast data from the API. Note the use of backticks and an expression to insert the zipcode
    return this.http
      .get<Forecast>(
        `${WeatherService.URL}/forecast/daily?zip=${zipcode},us&units=imperial&cnt=5&APPID=${WeatherService.APPID}`
      )
      .pipe(tap((forecast) => this._setForecastToCache(zipcode, forecast)));
  }
  /**
   * Retrieves the forecast from the local storage if still valid
   * @param zipcode Zipcode to search by
   */
  private _getForecastFromCache(zipcode: string): Forecast | undefined {
    const stor = localStorage.getItem(FORECASTS_LS_KEY);
    const cachedForecasts: ForecastAndZip[] = stor ? JSON.parse(stor) : [];
    if (!cachedForecasts.length) return undefined;
    const exists = cachedForecasts.find((f) => f.zip === zipcode);
    if (exists && exists.lastUpdate + this._cacheDuration < Date.now()) {
      // expired
      this._removeForecastFromCache(zipcode);
      return undefined;
    }
    return exists?.data;
  }
  /**
   * Stores forecast data, updating if already exists.
   */
  private _setForecastToCache(zipcode: string, forecast: Forecast) {
    const cachedForecasts = this._readForecastsFromCache();
    const idx = cachedForecasts.findIndex((f) => f.zip === zipcode);
    if (idx !== -1) {
      cachedForecasts[idx].data = forecast;
      cachedForecasts[idx].lastUpdate = Date.now();
    } else {
      cachedForecasts.push({
        zip: zipcode,
        data: forecast,
        lastUpdate: Date.now(),
      });
    }
    this._storeForecastsToCache(cachedForecasts);
  }
  /**
   * Removes the forecast from the local storage
   */
  private _removeForecastFromCache(zipcode: string) {
    const cachedForecasts = this._readForecastsFromCache();
    this._storeForecastsToCache(
      cachedForecasts.filter((f) => f.zip !== zipcode)
    );
  }
  /**
   * Reads the forecasts from the local storage.
   */
  private _readForecastsFromCache(): ForecastAndZip[] {
    const stor = localStorage.getItem(FORECASTS_LS_KEY);
    return stor ? JSON.parse(stor) : [];
  }
  /**
   * Stores forecasts to the local storage
   */
  private _storeForecastsToCache(forecasts: ForecastAndZip[]) {
    localStorage.setItem(FORECASTS_LS_KEY, JSON.stringify(forecasts));
  }
  /**
   * Reads the conditions from the local storage
   */
  private _readConditionsFromCache(): ConditionsAndZip[] {
    const existing = localStorage.getItem(CONDITIONS_LS_KEY);
    return existing ? JSON.parse(existing) : [];
  }
  private _storeConditionsToCache(conditions: ConditionsAndZip[]) {
    localStorage.setItem(CONDITIONS_LS_KEY, JSON.stringify(conditions));
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
