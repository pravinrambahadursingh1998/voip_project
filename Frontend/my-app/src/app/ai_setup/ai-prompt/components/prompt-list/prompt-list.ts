import {
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { AiPromptItem } from '../../ai-prompt.models';
import { AiPromptService } from '../../../../services/ai_prompt_service/ai-prompt';
import { AuthService } from '../../../../services/auth';
import { ToastService } from '../../../../shared/toast/toast.service';

@Component({
  selector: 'app-prompt-list',
  standalone: true,
  imports: [],
  templateUrl: './prompt-list.html',
  styleUrl: './prompt-list.css',
})
export class PromptList implements OnInit {
  private readonly aiPromptService = inject(AiPromptService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cd = inject(ChangeDetectorRef);

  readonly selectedId = input<string | null>(null);
  readonly isCreating = input(false);
  readonly reloadKey = input(0);

  readonly selectPrompt = output<string>();
  readonly createPrompt = output<void>();

  readonly search = signal('');
  prompts: AiPromptItem[] = [];
  token: any;
  private lastReloadKey = -1;

  constructor() {
    effect(() => {
      const key = this.reloadKey();
      if (key === this.lastReloadKey) {
        return;
      }
      this.lastReloadKey = key;
      if (this.token !== undefined) {
        this.loadPrompts();
      }
    });
  }

  ngOnInit(): void {
    this.token = this.authService.getToken();
    this.lastReloadKey = this.reloadKey();
    this.loadPrompts();
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.trim().toLowerCase());
  }

  get filteredPrompts(): AiPromptItem[] {
    const q = this.search();
    if (!q) {
      return this.prompts;
    }
    return this.prompts.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        String(p.extension ?? '')
          .toLowerCase()
          .includes(q) ||
        (p.introduction || '').toLowerCase().includes(q)
    );
  }

  private loadPrompts(): void {
    const companyId = this.token?.company_id;
    const queryParam = companyId ? `?company_id=${companyId}` : '';

    this.aiPromptService.getPrompts(queryParam).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.prompts = (res.data || []).map((item: any) => ({
            id: String(item.id),
            name: item.name,
            extension: item.extension,
            introduction: item.introduction || '',
            prompt: item.prompt || '',
            enabled: !!item.enabled,
          }));
        } else {
          this.prompts = [];
          if (res?.message) {
            this.toast.error(res.message);
          }
        }
        this.cd.detectChanges();
      },
      error: (err) => {
        this.prompts = [];
        this.toast.error(err?.error?.message || 'Failed to load prompts');
        this.cd.detectChanges();
      },
    });
  }
}
