import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth';
import { SpinnerService } from '../../shared/spinner/spinner.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AiPromptService } from '../../services/ai_prompt_service/ai-prompt';
import { AiFunctionService } from '../../services/ai_function_service/ai-function';
import { AiIntegrationService } from '../../services/ai_integration_service/ai-integration.service';

export interface ExtensionCard {
  extension: string;
  gatewayName?: string;
  prompt?: {
    id: string;
    name: string;
    introduction?: string;
    prompt?: string;
    enabled: boolean;
  } | null;
  functions: Array<{
    id?: string;
    name: string;
    type?: string;
    direction?: string;
    description?: string;
    isDefault?: boolean;
  }>;
  integration?: {
    id?: string;
    provider: string;
    base_url?: string;
    is_active?: boolean;
  } | null;
  status: 'configured' | 'partial' | 'unconfigured';
}

@Component({
  selector: 'app-extension-grid',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './extension-grid.html',
  styleUrl: './extension-grid.css',
})
export class ExtensionGrid implements OnInit {
  cards: ExtensionCard[] = [];
  filteredCards: ExtensionCard[] = [];
  searchQuery = '';
  selectedFilter: 'all' | 'configured' | 'unconfigured' = 'all';
  viewMode: 'grid' | 'card' = 'grid';

  readonly isLoading = signal(false);
  token: any = null;

  setViewMode(mode: 'grid' | 'card'): void {
    this.viewMode = mode;
    this.cd.detectChanges();
  }

  // Stats
  totalExtensions = 0;
  configuredPromptsCount = 0;
  totalFunctionsCount = 0;
  integrationsCount = 0;

  // Built-in standard booking tools that are always available
  readonly defaultBookingTools = [
    {
      name: 'get_available_slots',
      type: 'Built-in',
      direction: 'both',
      description: 'Checks open appointment times for a specific date',
      isDefault: true,
    },
    {
      name: 'book_appointment',
      type: 'Built-in',
      direction: 'both',
      description: 'Reserves chosen slot and initiates patient confirmation',
      isDefault: true,
    },
    {
      name: 'confirm_booking',
      type: 'Built-in',
      direction: 'both',
      description: 'Finalizes booking after patient verbal confirmation',
      isDefault: true,
    },
  ];

  constructor(
    private authService: AuthService,
    private promptService: AiPromptService,
    private functionService: AiFunctionService,
    private integrationService: AiIntegrationService,
    private spinner: SpinnerService,
    private toast: ToastService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.token = this.authService.getToken();
    this.loadData();
  }

  get companyId(): string | null {
    return this.token?.company_id || this.token?.company?.id || null;
  }

  loadData(): void {
    this.isLoading.set(true);
    this.spinner.show();

    const companyQuery = this.companyId ? `?company_id=${this.companyId}` : '';

    forkJoin({
      extensions: this.integrationService.getGatewayExtensions(this.companyId).pipe(
        catchError(() => of({ success: true, data: [] }))
      ),
      prompts: this.promptService.getPrompts(companyQuery).pipe(
        catchError(() => of({ success: true, data: [] }))
      ),
      functions: this.functionService.getFunctions(companyQuery).pipe(
        catchError(() => of({ success: true, data: [] }))
      ),
      integrations: this.integrationService.getIntegrations(this.companyId).pipe(
        catchError(() => of({ success: true, data: [] }))
      ),
    }).subscribe({
      next: ({ extensions, prompts, functions, integrations }) => {
        this.isLoading.set(false);
        this.spinner.hide();

        const extList: Array<{ value: string; label: string; gateway_name?: string }> =
          extensions?.data || [];
        const promptList: any[] = prompts?.data || [];
        const functionList: any[] = functions?.data || [];
        const integrationList: any[] = integrations?.data || [];

        // All custom functions configured for this tenant
        const customTools = functionList.map((fn) => ({
          id: fn.id,
          name: fn.name,
          type: fn.type || 'HTTP API',
          direction: fn.direction || 'both',
          description: fn.description || '',
          isDefault: false,
        }));

        // Set of all extension numbers from gateways & prompts & integrations
        const extensionMap = new Map<string, ExtensionCard>();

        // 1. Initialize from Gateways
        extList.forEach((ext) => {
          const extNum = String(ext.value || '').trim();
          if (!extNum) return;
          extensionMap.set(extNum, {
            extension: extNum,
            gatewayName: ext.gateway_name || ext.label || undefined,
            prompt: null,
            functions: [],
            integration: null,
            status: 'unconfigured',
          });
        });

        // 2. Map Prompts to extensions (and add if extension wasn't in gateway)
        promptList.forEach((p) => {
          const extNum = String(p.extension || '').trim();
          if (!extNum) return;

          let card = extensionMap.get(extNum);
          if (!card) {
            card = {
              extension: extNum,
              gatewayName: undefined,
              prompt: null,
              functions: [],
              integration: null,
              status: 'unconfigured',
            };
            extensionMap.set(extNum, card);
          }

          card.prompt = {
            id: p.id,
            name: p.name,
            introduction: p.introduction,
            prompt: p.prompt,
            enabled: p.enabled !== false,
          };
        });

        // 3. Map Integrations to extensions
        integrationList.forEach((integ) => {
          const extNum = String(integ.extension || '').trim();
          if (!extNum) return;

          let card = extensionMap.get(extNum);
          if (!card) {
            card = {
              extension: extNum,
              gatewayName: undefined,
              prompt: null,
              functions: [],
              integration: null,
              status: 'unconfigured',
            };
            extensionMap.set(extNum, card);
          }

          card.integration = {
            id: integ.id,
            provider: integ.provider,
            base_url: integ.base_url,
            is_active: !!integ.is_active,
          };
        });

        // 4. Determine available functions and status for each card
        const cardsArray: ExtensionCard[] = [];

        extensionMap.forEach((card) => {
          card.functions = [...this.defaultBookingTools, ...customTools];

          if (card.prompt && card.prompt.enabled) {
            card.status = 'configured';
          } else if (card.prompt || card.integration) {
            card.status = 'partial';
          } else {
            card.status = 'unconfigured';
          }

          cardsArray.push(card);
        });

        // Sort numerically by extension
        cardsArray.sort((a, b) =>
          a.extension.localeCompare(b.extension, undefined, { numeric: true })
        );

        this.cards = cardsArray;
        this.totalExtensions = cardsArray.length;
        this.configuredPromptsCount = cardsArray.filter((c) => !!c.prompt).length;
        this.totalFunctionsCount = this.defaultBookingTools.length + customTools.length;
        this.integrationsCount = cardsArray.filter((c) => !!c.integration).length;

        this.filterCards();
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.spinner.hide();
        console.error('Error loading extension overview:', err);
        this.toast.error('Failed to load extension overview.');
        this.cd.detectChanges();
      },
    });
  }

  onSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value || '';
    this.filterCards();
  }

  setFilter(filter: 'all' | 'configured' | 'unconfigured'): void {
    this.selectedFilter = filter;
    this.filterCards();
  }

  filterCards(): void {
    const q = this.searchQuery.trim().toLowerCase();

    this.filteredCards = this.cards.filter((card) => {
      if (this.selectedFilter === 'configured' && card.status !== 'configured') {
        return false;
      }
      if (this.selectedFilter === 'unconfigured' && card.status === 'configured') {
        return false;
      }

      if (!q) return true;

      const ext = card.extension.toLowerCase();
      const gw = (card.gatewayName || '').toLowerCase();
      const pName = (card.prompt?.name || '').toLowerCase();
      const pIntro = (card.prompt?.introduction || '').toLowerCase();
      const fnNames = card.functions.map((f) => f.name.toLowerCase()).join(' ');
      const integ = (card.integration?.provider || '').toLowerCase();

      return (
        ext.includes(q) ||
        gw.includes(q) ||
        pName.includes(q) ||
        pIntro.includes(q) ||
        fnNames.includes(q) ||
        integ.includes(q)
      );
    });
  }

  goToPrompt(promptId?: string, extension?: string): void {
    if (promptId) {
      this.router.navigate(['/ai-setup/ai-prompt'], { queryParams: { id: promptId } });
    } else {
      this.router.navigate(['/ai-setup/ai-prompt'], { queryParams: { extension } });
    }
  }

  goToFunctions(): void {
    this.router.navigate(['/ai-setup/ai-function']);
  }

  goToIntegrations(): void {
    this.router.navigate(['/ai-setup/integrations']);
  }
}
