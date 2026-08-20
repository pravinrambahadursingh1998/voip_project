import {
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AiPromptItem,
  emptyPrompt,
  getPromptVariableValues,
  PROMPT_VARIABLES,
  resolvePromptPlaceholders,
} from '../../ai-prompt.models';
import { AiPromptService } from '../../../../services/ai_prompt_service/ai-prompt';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SpinnerService } from '../../../../shared/spinner/spinner.service';

@Component({
  selector: 'app-prompt-aside',
  standalone: true,
  imports: [],
  templateUrl: './prompt-aside.html',
  styleUrl: './prompt-aside.css',
})
export class PromptAside {
  private readonly aiPromptService = inject(AiPromptService);
  private readonly toast = inject(ToastService);
  private readonly showSpinner = inject(SpinnerService);
  private readonly cd = inject(ChangeDetectorRef);

  readonly selectedId = input<string | null>(null);
  readonly isCreating = input(false);
  readonly draft = input<AiPromptItem | null>(null);

  readonly insertVariable = output<string>();

  readonly loadedPrompt = signal<AiPromptItem>(emptyPrompt());
  private syncedId: string | null = null;

  readonly preview = computed<AiPromptItem>(() => {
    const draft = this.draft();
    const id = this.selectedId();
    if (draft) {
      if (this.isCreating()) {
        return draft;
      }
      if (id && String(draft.id) === String(id)) {
        return draft;
      }
    }
    return this.loadedPrompt();
  });

  readonly compiledIntroduction = computed(() =>
    resolvePromptPlaceholders(this.preview().introduction || '')
  );

  readonly compiledPrompt = computed(() =>
    resolvePromptPlaceholders(this.preview().prompt || '')
  );

  readonly charCount = computed(() => {
    const text = this.compiledPrompt() || '';
    return text.length;
  });

  readonly variables = PROMPT_VARIABLES;
  readonly variableValues = getPromptVariableValues();

  constructor() {
    effect(() => {
      const creating = this.isCreating();
      const id = this.selectedId();
      const syncKey = creating ? '__creating__' : id;

      if (this.syncedId === syncKey) {
        return;
      }

      this.syncedId = syncKey;

      if (creating || !id) {
        this.loadedPrompt.set(emptyPrompt());
        this.cd.detectChanges();
        return;
      }

      this.loadPrompt(id);
    });
  }

  onChipClick(name: string): void {
    this.insertVariable.emit(name);
  }

  private loadPrompt(id: string): void {
    this.showSpinner.show();
    this.aiPromptService.getPrompt(id).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          const item = res.data;
          this.loadedPrompt.set({
            id: String(item.id),
            name: item.name || '',
            extension: item.extension || '',
            introduction: item.introduction || '',
            prompt: item.prompt || '',
            enabled: !!item.enabled,
          });
        } else {
          this.loadedPrompt.set(emptyPrompt());
          this.toast.error(res?.message || 'Failed to load prompt preview');
        }
        this.showSpinner.hide();
        this.cd.detectChanges();
      },
      error: (error) => {
        this.loadedPrompt.set(emptyPrompt());
        this.showSpinner.hide();
        this.toast.error(error?.error?.message || 'Something went wrong');
        this.cd.detectChanges();
      },
    });
  }
}
