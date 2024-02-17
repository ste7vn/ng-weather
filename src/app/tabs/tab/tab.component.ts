import { Component, Input } from "@angular/core";

@Component({
  selector: "app-tab",
  templateUrl: "./tab.component.html",
  styles: [
    `
      .tab {
        padding: 16px;
      }
    `,
  ],
})
export class TabComponent {
  @Input() title: string;
  @Input() active = false;
  @Input() actions: { icon: string; action: () => void }[] = [];
}
