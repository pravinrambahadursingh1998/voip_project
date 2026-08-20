import {
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs/operators';
import { AiFunctionItem, emptyFunction } from '../../ai-function.models';
import { AiFunctionService } from '../../../../services/ai_function_service/ai-function';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SpinnerService } from '../../../../shared/spinner/spinner.service';

@Component({
  selector: 'app-prompt-preview',
  standalone: true,
  imports: [],
  templateUrl: './prompt-preview.html',
  styleUrl: './prompt-preview.css',
})
export class PromptPreview {
  private readonly aiFunctionService = inject(AiFunctionService);
  private readonly toast = inject(ToastService);
  private readonly showSpinner = inject(SpinnerService);
  private readonly cd = inject(ChangeDetectorRef);

  readonly fn = input.required<AiFunctionItem>();
  readonly selectedId = input<string | null>(null);
  readonly isCreating = input(false);

  readonly loadedFn = signal<AiFunctionItem>(emptyFunction());
  readonly isTesting = signal(false);
  readonly testStatus = signal<string>('—');
  readonly testResponse = signal<string>(
    '{\n  "result": "Click Test to run this function"\n}'
  );

  private syncedId: string | null = null;

  constructor() {
    effect(() => {
      const creating = this.isCreating();
      const id = this.selectedId();
      const syncKey = creating ? '__creating__' : id;

      if (this.syncedId === syncKey) {
        return;
      }

      this.syncedId = syncKey;
      this.isTesting.set(false);

      if (creating || !id) {
        this.loadedFn.set(emptyFunction());
        this.testStatus.set('—');
        this.testResponse.set(
          '{\n  "result": "Sample response will appear here"\n}'
        );
        this.cd.detectChanges();
        return;
      }

      this.testStatus.set('Ready');
      this.testResponse.set(
        '{\n  "result": "Click Test to run this function"\n}'
      );
      this.getFunctionData(id);
    });
  }

  getFunctionData(id: string): void {
    this.showSpinner.show();
    this.aiFunctionService.getFunction(id).subscribe({
      next: (res) => {
        if (res.success == true && res.data) {
          const item = res.data;
          this.loadedFn.set({
            id: item.id,
            name: item.name,
            description: item.description,
            method: item.method,
            type: item.type,
            direction: item.direction || 'both',
            url: item.url,
            timeout: item.timeout,
            enabled: item.enabled,
            auth: item.headers?.Authorization || '',
            contentType: item.headers?.['Content-Type'] || 'application/json',
            parameters: item.parameters || [],
          });
        } else {
          this.loadedFn.set(emptyFunction());
          this.toast.error(res.message || 'Failed to load function');
        }
        this.showSpinner.hide();
        this.cd.detectChanges();
      },
      error: (error) => {
        this.loadedFn.set(emptyFunction());
        this.showSpinner.hide();
        this.toast.error(error?.error?.message || 'Something went wrong');
        this.cd.detectChanges();
      },
    });
  }

  readonly schemaJson = computed(() => {
    const item = this.isCreating() ? this.fn() : this.loadedFn();
    const name = item.name || 'new_function';
    const description = item.description || 'Describe what this function does';
    const properties = Object.fromEntries(
      (item.parameters || []).map((p) => [
        p.name,
        { type: p.type, description: p.description },
      ])
    );
    const required = (item.parameters || [])
      .filter((p) => p.required)
      .map((p) => p.name);

    return JSON.stringify(
      {
        name,
        description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      },
      null,
      2
    );
  });

  onTest(): void {
    if (this.isCreating() || this.isTesting()) {
      return;
    }

    const fn = this.loadedFn();
    if (!fn.url?.trim()) {
      this.toast.error('Endpoint URL is required to test this function');
      return;
    }

    const args = this.buildSampleArgs();
    const method = (fn.method || 'POST').toUpperCase();
    const isQueryMethod = method === 'GET' || method === 'DELETE';

    const headers = [
      {
        enabled: true,
        key: 'Content-Type',
        value: fn.contentType || 'application/json',
      },
    ];
    if (fn.auth?.trim()) {
      headers.push({
        enabled: true,
        key: 'Authorization',
        value: fn.auth.trim(),
      });
    }

    const payload = {
      method,
      url: fn.url.trim(),
      params: isQueryMethod
        ? Object.entries(args).map(([key, value]) => ({
            enabled: true,
            key,
            value: String(value ?? ''),
          }))
        : [],
      headers,
      bodyMode: isQueryMethod ? 'none' : 'raw',
      rawBody: isQueryMethod ? '' : JSON.stringify(args, null, 2),
      formDataRows: [],
      urlEncodedRows: [],
      authType: 'none',
      bearerToken: '',
      basicUsername: '',
      basicPassword: '',
      apiKeyName: '',
      apiKeyValue: '',
      apiKeyIn: 'header',
      timeout_ms: fn.timeout || 5000,
    };

    this.isTesting.set(true);
    this.testStatus.set('Testing…');
    this.showSpinner.show();

    this.aiFunctionService
      .testFunction(payload)
      .pipe(
        finalize(() => {
          this.isTesting.set(false);
          this.showSpinner.hide();
          this.cd.detectChanges();
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response?.success === false) {
            this.testStatus.set(
              response?.statusCode != null
                ? String(response.statusCode)
                : 'Failed'
            );
            this.testResponse.set(this.formatJson(response));
            this.toast.error(response.message || 'Function test failed');
            return;
          }

          const statusCode =
            response?.statusCode ?? response?.status ?? response?.data?.status;
          this.testStatus.set(
            statusCode != null ? String(statusCode) : 'OK'
          );
          this.testResponse.set(
            this.formatJson(response?.data ?? response)
          );
          this.toast.success(response?.message || 'Function tested successfully');
        },
        error: (error: any) => {
          const body = error?.error ?? { message: 'Something went wrong' };
          this.testStatus.set(
            body?.statusCode != null
              ? String(body.statusCode)
              : error?.status != null
                ? String(error.status)
                : 'Error'
          );
          this.testResponse.set(this.formatJson(body?.data ?? body));
          this.toast.error(body?.message || 'Something went wrong');
        },
      });
  }

  private buildSampleArgs(): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    for (const param of this.loadedFn().parameters || []) {
      switch (param.type) {
        case 'number':
        case 'integer':
          args[param.name] = 0;
          break;
        case 'boolean':
          args[param.name] = false;
          break;
        case 'array':
          args[param.name] = [];
          break;
        case 'object':
          args[param.name] = {};
          break;
        default:
          args[param.name] = '';
      }
    }
    return args;
  }

  private formatJson(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
}
