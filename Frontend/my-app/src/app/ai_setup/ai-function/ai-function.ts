import { Component, computed, signal } from '@angular/core';
import { FunctionList } from './components/function-list/function-list';
import { FunctionEditor } from './components/function-editor/function-editor';
import { PromptPreview } from './components/prompt-preview/prompt-preview';
import {
  AiFunctionItem,
  SAMPLE_FUNCTIONS,
  emptyFunction,
} from './ai-function.models';

@Component({
  selector: 'app-ai-function',
  standalone: true,
  imports: [FunctionList, FunctionEditor, PromptPreview],
  templateUrl: './ai-function.html',
  styleUrl: './ai-function.css',
})
export class AiFunction {
  readonly functions = signal<AiFunctionItem[]>([...SAMPLE_FUNCTIONS]);
  readonly selectedId = signal<string | null>(null);
  readonly isCreating = signal(false);

  readonly activeFunction = computed<AiFunctionItem>(() => {
    if (this.isCreating()) {
      return emptyFunction();
    }
    const id = this.selectedId();
    const list = this.functions();
    return list.find((fn) => fn.id === id) ?? list[0] ?? emptyFunction();
  });

  startNewFunction(): void {
    this.isCreating.set(true);
    this.selectedId.set(null);
  }

  selectFunction(id: string): void {
    this.isCreating.set(false);
    this.selectedId.set(id);
  }

  onFunctionSaved(item: AiFunctionItem): void {
    this.functions.update((list) => {
      const index = list.findIndex((fn) => fn.id === item.id);
      if (index === -1) {
        return [...list, item];
      }
      const next = [...list];
      next[index] = item;
      return next;
    });
    this.isCreating.set(false);
    this.selectedId.set(item.id);
  }

  onFunctionDeleted(id: string): void {
    this.functions.update((list) => list.filter((fn) => fn.id !== id));
    const remaining = this.functions();
    this.isCreating.set(false);
    this.selectedId.set(remaining[0]?.id ?? null);
  }
}
