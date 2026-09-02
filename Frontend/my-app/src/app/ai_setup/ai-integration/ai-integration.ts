import { Component, OnInit, signal } from '@angular/core';
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
import { SpinnerService } from '../../shared/spinner/spinner.service';
import { AuthService } from '../../services/auth';
import { AiIntegrationService } from '../../services/ai_integration_service/ai-integration.service';
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
export class AiIntegration implements OnInit {
  integrationForm!: FormGroup;
  readonly isSaving = signal(false);
  readonly isLoading = signal(false);
  readonly isLoadingExtensions = signal(false);
  readonly viewMode = signal<'list' | 'form'>('list');
  readonly editingId = signal<string | null>(null);

  integrations: AiIntegrationItem[] = [];
  gatewayExtensions: Array<{ value: string; label: string }> = [];
  token: any = null;

  readonly providers = [
    { value: 'opendental', label: 'OpenDental' },
  ];

  constructor(
    private fb: FormBuilder,
    private toast: ToastService,
    private spinner: SpinnerService,
    private authService: AuthService,
    private aiIntegrationService: AiIntegrationService,
  ) {
    this.integrationForm = this.fb.group({
      provider: ['opendental', Validators.required],
      extension: ['', Validators.required],
      api_key: ['', Validators.required],
      base_url: ['https://api.opendental.com/api/v1', Validators.required],
      is_active: [true],
    });
  }

  ngOnInit(): void {
    this.token = this.authService.getToken();
    this.loadGatewayExtensions();
    this.loadIntegrations();
  }

  get companyId(): string | null {
    return this.token?.company_id || this.token?.company?.id || null;
  }

  get userId(): string | null {
    return this.token?.id || null;
  }

  loadGatewayExtensions(): void {
    this.isLoadingExtensions.set(true);
    this.aiIntegrationService.getGatewayExtensions(this.companyId).subscribe({
      next: (res: any) => {
        this.isLoadingExtensions.set(false);
        if (res?.success && Array.isArray(res.data)) {
          this.gatewayExtensions = res.data;
        }
      },
      error: (err: any) => {
        this.isLoadingExtensions.set(false);
        console.error('Failed to load gateway extensions:', err);
      },
    });
  }

  loadIntegrations(): void {
    this.isLoading.set(true);
    this.aiIntegrationService.getIntegrations(this.companyId).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        if (res?.success && Array.isArray(res.data)) {
          this.integrations = res.data;
        } else {
          this.integrations = [];
        }
      },
      error: (err: any) => {
        this.isLoading.set(false);
        console.error('Failed to load integrations:', err);
        this.toast.error(err.error?.message || 'Failed to load integrations.');
      },
    });
  }

  showList(): void {
    this.viewMode.set('list');
    this.editingId.set(null);
  }

  showForm(): void {
    this.editingId.set(null);
    this.integrationForm.reset({
      provider: 'opendental',
      extension: this.gatewayExtensions.length === 1 ? this.gatewayExtensions[0].value : '',
      api_key: '',
      base_url: 'https://api.opendental.com/api/v1',
      is_active: true,
    });
    this.viewMode.set('form');
  }

  onEditIntegration(id: string): void {
    const item = this.integrations.find((i) => String(i.id) === String(id));
    this.editingId.set(id);

    if (item) {
      this.integrationForm.reset({
        provider: item.provider,
        extension: item.extension ?? '',
        api_key: item.api_key ?? '',
        base_url: item.base_url ?? 'https://api.opendental.com/api/v1',
        is_active: item.is_active !== undefined ? item.is_active : true,
      });
      this.viewMode.set('form');
      return;
    }

    this.spinner.show();
    this.aiIntegrationService.getIntegration(id).subscribe({
      next: (res: any) => {
        this.spinner.hide();
        if (res?.success && res.data) {
          const data = res.data;
          this.integrationForm.reset({
            provider: data.provider,
            extension: data.extension ?? '',
            api_key: data.api_key ?? '',
            base_url: data.base_url ?? 'https://api.opendental.com/api/v1',
            is_active: data.is_active !== undefined ? data.is_active : true,
          });
          this.viewMode.set('form');
        } else {
          this.toast.error(res?.message || 'Failed to fetch integration details.');
        }
      },
      error: (err: any) => {
        this.spinner.hide();
        this.toast.error(err.error?.message || 'Failed to fetch integration details.');
      },
    });
  }

  onDeleteIntegration(id: string): void {
    if (!id) return;

    this.spinner.show();
    this.aiIntegrationService.deleteIntegration(id).subscribe({
      next: (res: any) => {
        this.spinner.hide();
        if (res?.success) {
          this.toast.success(res.message || 'Integration deleted successfully.');
          this.loadIntegrations();
        } else {
          this.toast.error(res?.message || 'Failed to delete integration.');
        }
      },
      error: (err: any) => {
        this.spinner.hide();
        this.toast.error(err.error?.message || 'Failed to delete integration.');
      },
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.integrationForm.get(controlName);
    return !!(control && control.touched && control.invalid);
  }

  onProviderChange(): void {
    const provider = this.integrationForm.get('provider')?.value;
    if (provider === 'opendental') {
      this.integrationForm.patchValue({
        base_url: 'https://api.opendental.com/api/v1',
      });
    }
  }

  integrationFormSubmit(): void {
    if (!this.integrationForm.valid) {
      this.integrationForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }

    if (this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.spinner.show();

    const formValue = this.integrationForm.value;
    const editId = this.editingId();

    const payload = {
      ...formValue,
      id: editId || undefined,
      company_id: this.companyId,
      user_id: this.userId,
      is_active: !!formValue.is_active,
    };

    const request$ = editId
      ? this.aiIntegrationService.updateIntegration(editId, payload)
      : this.aiIntegrationService.createIntegration(payload);

    request$.subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        this.spinner.hide();
        if (res?.success) {
          this.toast.success(
            res.message ||
              (editId
                ? 'Integration updated successfully.'
                : 'Integration saved successfully.')
          );
          this.loadIntegrations();
          this.showList();
        } else {
          this.toast.error(res?.message || 'Failed to save integration.');
        }
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.spinner.hide();
        console.error('Failed to save integration:', err);
        this.toast.error(
          err.error?.message || 'Something went wrong while saving integration.'
        );
      },
    });
  }
}
