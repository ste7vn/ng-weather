import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { TabsGroupComponent } from "./tabs-group/tabs-group.component";
import { TabComponent } from "./tab/tab.component";

@NgModule({
  declarations: [TabsGroupComponent, TabComponent],
  imports: [CommonModule],
  exports: [TabsGroupComponent, TabComponent],
})
export class TabsModule {}
