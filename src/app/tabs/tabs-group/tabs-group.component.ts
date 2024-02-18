import {
  AfterContentInit,
  Component,
  ContentChildren,
  OnDestroy,
  QueryList,
} from "@angular/core";
import { Subject } from "rxjs";
import { startWith, takeUntil } from "rxjs/operators";
import { TabComponent } from "../tab/tab.component";

@Component({
  selector: "app-tabs-group",
  templateUrl: "./tabs-group.component.html",
  styleUrls: ["./tabs-group.component.scss"],
})
export class TabsGroupComponent implements AfterContentInit, OnDestroy {
  private _destroy$ = new Subject<void>();

  @ContentChildren(TabComponent) tabs: QueryList<TabComponent>;

  ngAfterContentInit() {
    this.tabs.changes
      .pipe(startWith([]), takeUntil(this._destroy$))
      .subscribe(() => {
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
    setTimeout(() => {
      // make sure that the change detection is triggered after the tab is selected
      this.tabs.toArray().forEach((tb, idx) => {
        if (idx !== index && tb.active) tb.active = false; // avoid setting tab to inactive if it's already inactive
      });
      if (!tab.active) tab.active = true;
    });
  }
}
