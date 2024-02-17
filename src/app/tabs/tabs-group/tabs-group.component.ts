import {
  Component,
  ContentChildren,
  QueryList,
  AfterContentInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { TabComponent } from "../tab/tab.component";
import { BehaviorSubject, Subject, combineLatest } from "rxjs";
import { startWith, takeUntil } from "rxjs/operators";

@Component({
  selector: "app-tabs-group",
  templateUrl: "./tabs-group.component.html",
  styleUrls: ["./tabs-group.component.scss"],
})
export class TabsGroupComponent
  implements OnChanges, AfterContentInit, OnDestroy
{
  private _destroy$ = new Subject<void>();
  private _selectedTabInput$ = new BehaviorSubject<number>(undefined);

  @Input() selectedTab: number;
  @Output() selectedTabChange = new EventEmitter<number>();

  @ContentChildren(TabComponent) tabs: QueryList<TabComponent>;

  private _contentInitialized = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.selectedTab) {
      this._selectedTabInput$.next(this.selectedTab);
    }
  }

  ngAfterContentInit() {
    combineLatest([
      this.tabs.changes.pipe(startWith([])),
      this._selectedTabInput$,
    ])
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        if (this.selectedTab != undefined) {
          // selecting the tab based on the selectedTab input
          const found = this.tabs.toArray()[this.selectedTab];
          if (found) {
            this.selectTab(found, this.selectedTab);
            return;
          }
        }
        let activeTabs = this.tabs.filter((tab) => tab.active);
        if (activeTabs.length === 0 && this.tabs.length > 0) {
          this.selectTab(this.tabs.first, 0);
        } else if (activeTabs.length > 1) {
          // makes sure that only one tab is active at a time
          this.selectTab(activeTabs[0], 0);
        }
      });
  }

  ngOnDestroy() {
    this._destroy$.next();
  }

  protected selectTab(tab: TabComponent, index: number) {
    if (tab.active) return;
    const select = () => {
      this.tabs.toArray().forEach((tab) => (tab.active = false));
      tab.active = true;
      this.selectedTabChange.emit(index);
    };
    if (this._contentInitialized) {
      select();
    } else {
      this._contentInitialized = true;
      setTimeout(() => {
        // making sure that the tab is set within another change detection cycle
        select();
      });
    }
  }
}
