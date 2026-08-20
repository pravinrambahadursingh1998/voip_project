import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { ToastService } from '../../shared/toast/toast.service';
import {
  AiIntegrationItem,
  IntegrationList,
} from './components/integration-list/integration-list';

@Component({
  selector: 'app-ai-integration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    IntegrationList,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
  ],
  templateUrl: './ai-integration.html',
  styleUrl: './ai-integration.css',
})
export class AiIntegration {
  integrationForm!: FormGroup;
  readonly isSaving = signal(false);
  readonly isTesting = signal(false);
  readonly isVerified = signal(false);
  readonly viewMode = signal<'list' | 'form'>('list');
  readonly editingId = signal<string | null>(null);

  /** UI-only local list until API is wired */
  integrations: AiIntegrationItem[] = [];

  readonly providers = [
    { value: 'opendental', label: 'OpenDental' },
  ];

  constructor(
    private fb: FormBuilder,
    private toast: ToastService,
  ) {
    this.integrationForm = this.fb.group({
      provider: ['opendental', Validators.required],
      api_key: ['', Validators.required],
      base_url: ['https://api.opendental.com/api/v1', Validators.required],
      is_active: [true],
    });
  }

  showList(): void {
    this.viewMode.set('list');
    this.editingId.set(null);
  }

  showForm(): void {
    this.isVerified.set(false);
    this.editingId.set(null);
    this.integrationForm.reset({
      provider: 'opendental',
      api_key: '',
      base_url: 'https://api.opendental.com/api/v1',
      is_active: true,
    });
    this.viewMode.set('form');
  }

  onEditIntegration(id: string): void {
    const item = this.integrations.find((i) => i.id === id);
    if (!item) {
      return;
    }
    this.editingId.set(id);
    this.isVerified.set(true);
    this.integrationForm.reset({
      provider: item.provider,
      api_key: item.api_key ?? '',
      base_url: item.base_url ?? 'https://api.opendental.com/api/v1',
      is_active: item.is_active ?? true,
    });
    this.viewMode.set('form');
  }

  onDeleteIntegration(id: string): void {
    this.integrations = this.integrations.filter((i) => i.id !== id);
    this.toast.success('Integration removed (UI only).');
  }

  isInvalid(controlName: string): boolean {
    const control = this.integrationForm.get(controlName);
    return !!(control && control.touched && control.invalid);
  }

  onProviderChange(): void {
    this.isVerified.set(false);
    const provider = this.integrationForm.get('provider')?.value;
    if (provider === 'opendental') {
      this.integrationForm.patchValue({
        base_url: 'https://api.opendental.com/api/v1',
      });
    }
  }

  testConnection(): void {
    if (this.integrationForm.invalid) {
      this.integrationForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }
    if (this.isTesting()) {
      return;
    }

    this.isTesting.set(true);
    // UI-only: simulate success until backend exists
    setTimeout(() => {
      this.isTesting.set(false);
      this.isVerified.set(true);
      this.toast.success('Connection looks ready (UI only — API not wired yet).');
    }, 600);
  }

  integrationFormSubmit(): void {
    if (!this.integrationForm.valid) {
      this.integrationForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }
    if (!this.isVerified()) {
      this.toast.error('Please test the connection before saving.');
      return;
    }
    if (this.isSaving() || this.isTesting()) {
      return;
    }

    this.isSaving.set(true);
    const value = this.integrationForm.value;
    const editId = this.editingId();

    setTimeout(() => {
      if (editId) {
        this.integrations = this.integrations.map((item) =>
          item.id === editId
            ? {
                ...item,
                provider: value.provider,
                api_key: value.api_key,
                base_url: value.base_url,
                is_active: !!value.is_active,
              }
            : item
        );
        this.toast.success('Integration updated (UI only).');
      } else {
        this.integrations = [
          ...this.integrations,
          {
            id: `local-${Date.now()}`,
            provider: value.provider,
            api_key: value.api_key,
            base_url: value.base_url,
            is_active: !!value.is_active,
          },
        ];
        this.toast.success('Integration saved (UI only).');
      }
      this.isSaving.set(false);
      this.showList();
    }, 400);
  }
}
