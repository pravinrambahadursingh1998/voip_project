import { Component, signal } from '@angular/core';
import { PromptList } from '../components/prompt-list/prompt-list';
import { PromptEditor } from '../components/prompt-editor/prompt-editor';
import { PromptAside } from '../components/prompt-aside/prompt-aside';
import { AiPromptItem } from '../ai-prompt.models';

@Component({
  selector: 'app-ai-prompt',
  standalone: true,
  imports: [PromptList, PromptEditor, PromptAside],
  templateUrl: './ai-prompt.html',
  styleUrl: './ai-prompt.css',
})
export class AiPrompt {
  readonly selectedId = signal<string | null>(null);
  readonly isCreating = signal(false);
  readonly listReloadKey = signal(0);
  readonly draftPrompt = signal<AiPromptItem | null>(null);
  readonly insertVariableToken = signal<{ name: string; at: number } | null>(
    null
  );

  startNewPrompt(): void {
    this.isCreating.set(true);
    this.selectedId.set(null);
    this.draftPrompt.set(null);
  }

  selectPrompt(id: string): void {
    this.isCreating.set(false);
    this.selectedId.set(String(id));
    this.draftPrompt.set(null);
  }

  onPromptSaved(item: AiPromptItem): void {
    this.isCreating.set(false);
    this.selectedId.set(String(item.id));
    this.draftPrompt.set(item);
    this.listReloadKey.update((n) => n + 1);
  }

  onPromptDeleted(id: string): void {
    this.isCreating.set(false);
    this.selectedId.set(null);
    this.draftPrompt.set(null);
    this.listReloadKey.update((n) => n + 1);
  }

  onDraftChange(item: AiPromptItem): void {
    this.draftPrompt.set(item);
  }

  onInsertVariable(name: string): void {
    this.insertVariableToken.set({ name, at: Date.now() });
  }
}
