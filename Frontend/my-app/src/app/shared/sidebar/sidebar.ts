import { NgIf } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class SidebarComponent {
  readonly collapsed = input(false);
  readonly toggleSidebar = output<void>();

  readonly gatewaysExpanded = signal(true);
  readonly aiSetupExpanded = signal(true);
  readonly managementExpanded = signal(true);

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  toggleGateways(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.gatewaysExpanded.update((open) => !open);
  }

  toggleAiSetup(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.aiSetupExpanded.update((open) => !open);
  }

  toggleManagement(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.managementExpanded.update((open) => !open);
  }
}
