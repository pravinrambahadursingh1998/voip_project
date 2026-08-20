import { Component, input, output } from '@angular/core';

export interface AiIntegrationItem {
  id: string;
  provider: string;
  api_key?: string;
  base_url?: string;
  is_active?: boolean;
}

@Component({
  selector: 'app-integration-list',
  standalone: true,
  imports: [],
  templateUrl: './integration-list.html',
  styleUrl: './integration-list.css',
})
export class IntegrationList {
  readonly integrations = input<AiIntegrationItem[]>([]);
  readonly createIntegration = output<void>();
  readonly editIntegration = output<string>();
  readonly deleteIntegration = output<string>();

  maskApiKey(key?: string): string {
    if (!key) {
      return '—';
    }
    if (key.length <= 8) {
      return '••••••••';
    }
    return `${key.slice(0, 3)}••••••••${key.slice(-4)}`;
  }

  providerLabel(value: string): string {
    const labels: Record<string, string> = {
      opendental: 'OpenDental',
    };
    return labels[value] || value || '—';
  }
}
