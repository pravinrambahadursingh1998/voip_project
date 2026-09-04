import { ChangeDetectorRef, Component, Input, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiIntegrationService } from '../../../../services/ai_integration_service/ai-integration.service';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SpinnerService } from '../../../../shared/spinner/spinner.service';
import { AuthService } from '../../../../services/auth';

export interface AiIntegrationItem {
  id: string | number;
  company_id?: string | number | null;
  provider: string;
  api_key?: string;
  headers?: string;
  content_type?: string;
  base_url?: string;
  extension?: string;
  is_active?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-integration-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './integration-list.html',
  styleUrl: './integration-list.css',
})
export class IntegrationList implements OnInit {
  @Input() set integrations(data: AiIntegrationItem[] | null | undefined) {
    if (Array.isArray(data)) {
      this.integrationsList = data;
      this.filterData();
    }
  }

  integrationsList: AiIntegrationItem[] = [];
  filteredIntegrations: AiIntegrationItem[] = [];
  searchQuery = '';
  token: any = null;
  displayMode: 'grid' | 'card' = 'grid';

  readonly createIntegration = output<void>();
  readonly editIntegration = output<AiIntegrationItem>();
  readonly deleteIntegration = output<string>();

  setDisplayMode(mode: 'grid' | 'card'): void {
    this.displayMode = mode;
    this.cd.detectChanges();
  }

  constructor(
    private aiIntegrationService: AiIntegrationService,
    private toast: ToastService,
    private spinner: SpinnerService,
    private authService: AuthService,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.token = this.authService.getToken();
    this.getIntegrations();
  }

  get companyId(): string | null {
    return this.token?.company_id || this.token?.company?.id || null;
  }

  getIntegrations(): void {
    this.spinner.show();
    this.aiIntegrationService.getIntegrations(this.companyId).subscribe({
      next: (res: any) => {
        if (res?.success && Array.isArray(res.data)) {
          this.integrationsList = res.data;
          this.filterData();
        } else {
          this.integrationsList = [];
          this.filteredIntegrations = [];
        }
        this.spinner.hide();
        this.cd.detectChanges();
      },
      error: (err: any) => {
        console.error('Failed to load integrations:', err);
        this.toast.error(err.error?.message || 'Failed to load integrations.');
        this.spinner.hide();
        this.cd.detectChanges();
      },
    });
  }

  onSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value || '';
    this.filterData();
  }

  filterData(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredIntegrations = [...this.integrationsList];
      return;
    }
    this.filteredIntegrations = this.integrationsList.filter((item) => {
      const provider = (item.provider || '').toLowerCase();
      const ext = (item.extension || '').toLowerCase();
      const url = (item.base_url || '').toLowerCase();
      return provider.includes(q) || ext.includes(q) || url.includes(q);
    });
  }

  onDelete(id: string | number): void {
    const strId = String(id);
    if (!strId) return;

    this.spinner.show();
    this.aiIntegrationService.deleteIntegration(strId).subscribe({
      next: (res: any) => {
        this.spinner.hide();
        if (res?.success) {
          this.toast.success(res.message || 'Integration deleted successfully.');
          this.getIntegrations();
          this.deleteIntegration.emit(strId);
        } else {
          this.toast.error(res?.message || 'Failed to delete integration.');
        }
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.spinner.hide();
        this.toast.error(err.error?.message || 'Failed to delete integration.');
        this.cd.detectChanges();
      },
    });
  }

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

  formatHeaderDisplay(item: AiIntegrationItem): string {
    if (item.headers && item.headers.trim()) {
      const h = item.headers.trim();
      return h.length > 28 ? `${h.slice(0, 16)}…` : h;
    }
    if (item.provider === 'opendental' && item.api_key) {
      return `ODFHIR ${this.maskApiKey(item.api_key)}`;
    }
    return '—';
  }
}
