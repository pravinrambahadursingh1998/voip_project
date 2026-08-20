import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AiPromptItem,
  AiPromptPayload,
  emptyPrompt,
  PROMPT_VARIABLES,
} from '../../ai-prompt.models';
import { AiPromptService } from '../../../../services/ai_prompt_service/ai-prompt';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SpinnerService } from '../../../../shared/spinner/spinner.service';
import { AuthService } from '../../../../services/auth';

@Component({
  selector: 'app-prompt-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './prompt-editor.html',
  styleUrl: './prompt-editor.css',
})
export class PromptEditor implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly aiPromptService = inject(AiPromptService);
  private readonly toast = inject(ToastService);
  private readonly showSpinner = inject(SpinnerService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('promptTextarea')
  private promptTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly selectedId = input<string | null>(null);
  readonly isCreating = input(false);
  readonly insertVariable = input<{ name: string; at: number } | null>(null);

  readonly saved = output<AiPromptItem>();
  readonly deleted = output<string>();
  readonly draftChange = output<AiPromptItem>();

  readonly isSaving = signal(false);
  readonly isDeleting = signal(false);
  readonly submitted = signal(false);
  readonly varMenuOpen = signal(false);
  readonly varSuggestions = signal<string[]>([]);

  readonly variables = PROMPT_VARIABLES;

  token: any;
  currentPromptId: string | null = null;

  readonly promptForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    extension: ['', Validators.required],
    introduction: ['', Validators.required],
    prompt: ['', Validators.required],
    enabled: [true],
  });

  readonly extensions = [
    { value: '1006', label: '1006 — EmailSMS' },
    { value: '1001', label: '1001 — Main Queue' },
    { value: '2040', label: '2040 — Sales' },
    { value: '3012', label: '3012 — Billing' },
  ];

  private syncedId: string | null = null;
  private lastInsertAt = 0;
  private mentionStart: number | null = null;

  constructor() {
    effect(() => {
      const creating = this.isCreating();
      const id = this.selectedId();
      const syncKey = creating ? '__creating__' : id;

      if (this.syncedId === syncKey) {
        return;
      }

      this.syncedId = syncKey;
      this.submitted.set(false);

      if (creating || !id) {
        this.currentPromptId = null;
        this.patchFromItem(emptyPrompt());
        this.emitDraft();
        this.cd.detectChanges();
        return;
      }

      this.getPromptData(id);
    });

    effect(() => {
      const token = this.insertVariable();
      if (!token || token.at === this.lastInsertAt) {
        return;
      }
      this.lastInsertAt = token.at;
      this.closeVarMenus();
      this.insertIntoPrompt(token.name);
    });
  }

  ngOnInit(): void {
    this.token = this.authService.getToken();
    this.promptForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.emitDraft();
      });
  }

  get lineCount(): number {
    const text = String(this.promptForm.get('prompt')?.value ?? '');
    if (!text) {
      return 0;
    }
    return text.split(/\r\n|\r|\n/).length;
  }

  get wordCount(): number {
    const text = String(this.promptForm.get('prompt')?.value ?? '').trim();
    if (!text) {
      return 0;
    }
    return text.split(/\s+/).filter(Boolean).length;
  }

  isInvalid(controlName: string): boolean {
    const control = this.promptForm.get(controlName);
    return !!(
      control &&
      control.invalid &&
      (control.touched || this.submitted())
    );
  }

  toggleVarMenu(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.varMenuOpen();
    this.varMenuOpen.set(next);
    if (next) {
      this.varSuggestions.set([]);
      this.mentionStart = null;
    }
  }

  closeVarMenus(): void {
    this.varMenuOpen.set(false);
    this.varSuggestions.set([]);
    this.mentionStart = null;
  }

  onSelectVariable(name: string, event?: MouseEvent): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.insertIntoPrompt(name);
    this.closeVarMenus();
  }

  onPromptKeyup(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeVarMenus();
      return;
    }
    this.updateMentionSuggestions();
  }

  onPromptClick(): void {
    this.updateMentionSuggestions();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.varMenuOpen() || this.varSuggestions().length) {
      this.closeVarMenus();
    }
  }

  resetForm(): void {
    if (this.currentPromptId) {
      this.getPromptData(this.currentPromptId);
    } else {
      this.patchFromItem(emptyPrompt());
      this.emitDraft();
    }
    this.submitted.set(false);
    this.toast.info('Form reset');
  }

  onDelete(): void {
    const id = this.currentPromptId;
    if (!id || this.isDeleting() || this.isSaving()) {
      return;
    }

    const name = this.promptForm.get('name')?.value || 'this prompt';
    if (!confirm(`Delete prompt “${name}”?`)) {
      return;
    }

    this.isDeleting.set(true);
    this.showSpinner.show();
    this.aiPromptService.deletePrompt(id).subscribe({
      next: (response: any) => {
        this.showSpinner.hide();
        this.isDeleting.set(false);
        if (response?.success === false) {
          this.toast.error(response.message || 'Failed to delete prompt');
          this.cd.detectChanges();
          return;
        }
        this.toast.success(response?.message || 'Prompt deleted');
        this.currentPromptId = null;
        this.patchFromItem(emptyPrompt());
        this.deleted.emit(id);
        this.emitDraft();
        this.cd.detectChanges();
      },
      error: (error: any) => {
        this.showSpinner.hide();
        this.isDeleting.set(false);
        this.toast.error(error?.error?.message || 'Something went wrong');
        this.cd.detectChanges();
      },
    });
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.promptForm.invalid) {
      this.promptForm.markAllAsTouched();
      this.toast.error('Please fill all required fields correctly');
      return;
    }

    if (this.isSaving() || this.isDeleting()) {
      return;
    }

    const payload = this.buildPayload();
    this.isSaving.set(true);
    this.showSpinner.show();

    this.aiPromptService.createPrompt(payload).subscribe({
      next: (response: any) => {
        this.showSpinner.hide();
        this.isSaving.set(false);

        if (response?.success === false) {
          this.toast.error(response.message || 'Failed to save prompt');
          this.cd.detectChanges();
          return;
        }

        this.toast.success(response?.message || 'Prompt saved successfully');
        const data = response?.data;
        const savedId = data?.id != null ? String(data.id) : this.currentPromptId;
        if (savedId) {
          this.currentPromptId = savedId;
          this.syncedId = savedId;
        }
        this.promptForm.markAsPristine();

        const item: AiPromptItem = {
          id: savedId || '',
          name: data?.name ?? payload.name,
          extension: data?.extension ?? payload.extension,
          introduction: data?.introduction ?? payload.introduction,
          prompt: data?.prompt ?? payload.prompt,
          enabled: data?.enabled ?? payload.enabled,
        };
        this.saved.emit(item);
        this.emitDraft();
        this.cd.detectChanges();
      },
      error: (error: any) => {
        this.showSpinner.hide();
        this.isSaving.set(false);
        this.toast.error(error?.error?.message || 'Something went wrong');
        this.cd.detectChanges();
      },
    });
  }

  private getPromptData(id: string): void {
    this.showSpinner.show();
    this.aiPromptService.getPrompt(id).subscribe({
      next: (res) => {
        if (res.success === true && res.data) {
          const item = res.data;
          this.currentPromptId = String(item.id);
          this.patchFromItem({
            name: item.name,
            extension: item.extension,
            introduction: item.introduction,
            prompt: item.prompt,
            enabled: item.enabled,
          });
          this.emitDraft();
        } else {
          this.toast.error(res.message || 'Failed to load prompt');
          this.patchFromItem(emptyPrompt());
          this.emitDraft();
        }
        this.showSpinner.hide();
        this.cd.detectChanges();
      },
      error: (error) => {
        this.showSpinner.hide();
        this.toast.error(error?.error?.message || 'Something went wrong');
        this.cd.detectChanges();
      },
    });
  }

  private buildPayload(): AiPromptPayload {
    const raw = this.promptForm.getRawValue();
    return {
      id: this.currentPromptId,
      company_id: this.token?.company_id ?? null,
      user_id: this.token?.id ?? null,
      name: String(raw.name).trim(),
      extension: String(raw.extension).trim(),
      introduction: String(raw.introduction).trim(),
      prompt: String(raw.prompt).trim(),
      enabled: !!raw.enabled,
    };
  }

  private patchFromItem(item: {
    name: string;
    extension: string;
    introduction: string;
    prompt: string;
    enabled: boolean;
  }): void {
    this.promptForm.patchValue(
      {
        name: item.name,
        extension: item.extension,
        introduction: item.introduction,
        prompt: item.prompt,
        enabled: item.enabled,
      },
      { emitEvent: false }
    );
    this.promptForm.markAsPristine();
    this.promptForm.markAsUntouched();
  }

  private emitDraft(): void {
    const raw = this.promptForm.getRawValue();
    this.draftChange.emit({
      id: this.currentPromptId || '',
      name: String(raw.name ?? ''),
      extension: String(raw.extension ?? ''),
      introduction: String(raw.introduction ?? ''),
      prompt: String(raw.prompt ?? ''),
      enabled: !!raw.enabled,
    });
  }

  private insertIntoPrompt(variable: string): void {
    const control = this.promptForm.get('prompt');
    if (!control) {
      return;
    }

    const token = variable.startsWith('%') ? variable : `%${variable}`;
    const current = String(control.value ?? '');
    const el = this.promptTextarea?.nativeElement;
    const caret = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? caret;

    let next: string;
    let newCaret: number;

    if (this.mentionStart != null && this.mentionStart <= caret) {
      next = `${current.slice(0, this.mentionStart)}${token}${current.slice(caret)}`;
      newCaret = this.mentionStart + token.length;
    } else {
      next = `${current.slice(0, caret)}${token}${current.slice(end)}`;
      newCaret = caret + token.length;
    }

    control.setValue(next);
    control.markAsDirty();
    this.emitDraft();
    this.cd.detectChanges();

    queueMicrotask(() => {
      const textarea = this.promptTextarea?.nativeElement;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(newCaret, newCaret);
    });
  }

  private updateMentionSuggestions(): void {
    const el = this.promptTextarea?.nativeElement;
    if (!el) {
      this.varSuggestions.set([]);
      this.mentionStart = null;
      return;
    }

    const value = el.value;
    const caret = el.selectionStart ?? 0;
    const before = value.slice(0, caret);
    const match = before.match(/%([a-zA-Z0-9_]*)$/);

    if (!match) {
      this.varSuggestions.set([]);
      this.mentionStart = null;
      return;
    }

    this.mentionStart = caret - match[0].length;
    const query = match[1].toLowerCase();
    const filtered = this.variables.filter((v) =>
      v.toLowerCase().startsWith(query)
    );
    this.varSuggestions.set(filtered);
    this.varMenuOpen.set(false);
  }
}
