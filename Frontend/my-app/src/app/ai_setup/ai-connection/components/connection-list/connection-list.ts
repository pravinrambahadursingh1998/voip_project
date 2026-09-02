import { ChangeDetectorRef, Component, OnInit, output } from '@angular/core';
import { AiSettingService } from '../../../../services/ai_setting_service/ai_setting_service';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SpinnerService } from '../../../../shared/spinner/spinner.service';
import { AuthService } from '../../../../services/auth';


export interface AiConnectionItem {
  id: string;
  provider: string;
  model: string;
  api_key?: string;
  temperature?: number;
  max_tokens?: number;
  confidence_threshold?: number;
  similarity_threshold?: number;
}

@Component({
  selector: 'app-connection-list',
  standalone: true,
  imports: [],
  templateUrl: './connection-list.html',
  styleUrl: './connection-list.css',
})
export class ConnectionList implements OnInit {
  connections: any[] = [];
  currentPage = 1;
  perPage = 10;
  totalItems = 0;
  readonly createConnection = output<void>();
  readonly editConnection = output<string>();
  readonly deleteConnection = output<string>();
  constructor(private aiSettingService: AiSettingService,
    private toast: ToastService,
    private spinner: SpinnerService,
    private authService: AuthService,
    private cd: ChangeDetectorRef) { }
  token: any;
  ngOnInit(): void {
    this.token = this.authService.getToken();
    this.getConnections();
  }

  getConnections(): void {
    this.spinner.show();
    const payload: Record<string, string | number> = {
      page: this.currentPage,
      perPage: this.perPage,
    };
    if (this.token?.company_id != null) {
      payload['company_id'] = this.token.company_id;
    }
    this.aiSettingService.getAiSettingsList(payload).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.connections = response.data;
          this.totalItems = response.pagination?.rowCount ?? response.data?.length ?? 0;
        } else {
          this.toast.error(response.message);
        }
        this.spinner.hide();
        this.cd.detectChanges();
      },
      error: (err: any) => {
        this.toast.error(err.error?.message || 'Failed to load connections.');
        this.spinner.hide();
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
      openai: 'OpenAI',
      azure: 'Azure OpenAI',
      anthropic: 'Anthropic',
      gemini: 'Google Gemini',
      groq: 'Groq',
      mistral: 'Mistral AI',
      cohere: 'Cohere',
      deepseek: 'DeepSeek',
      ollama: 'Ollama',
      custom: 'Custom',
    };
    return labels[value] || value || '—';
  }
}
