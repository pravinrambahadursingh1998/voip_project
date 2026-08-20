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
import {AiSettingService} from '../../services/ai_setting_service/ai_setting_service'
import { AuthService } from '../../services/auth';
import {
  AiConnectionItem,
  ConnectionList,
} from './components/connection-list/connection-list';
@Component({
  selector: 'app-ai-connection',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatProgressSpinnerModule,
    ConnectionList,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
  ],
  templateUrl: './ai-connection.html',
  styleUrl: './ai-connection.css',
})
export class AiConnection implements OnInit {
  connectionForm!: FormGroup;
  readonly isSaving = signal(false);
  readonly isTesting = signal(false);
  isConnectionVerified = signal(false);
  readonly viewMode = signal<'list' | 'form'>('list');
  connections: AiConnectionItem[] = [];
  models: any[] = [];
  token:any

  readonly providers = [
    { value: 'openai', label: 'OpenAI', icon: 'assets/icons/openai.svg' },
    { value: 'azure', label: 'Azure OpenAI', icon: 'assets/icons/azure.svg' },
    { value: 'anthropic', label: 'Anthropic', icon: 'assets/icons/anthropic.svg' },
    { value: 'gemini', label: 'Google Gemini', icon: 'assets/icons/gemini.svg' },
    { value: 'groq', label: 'Groq', icon: 'assets/icons/groq.svg' },
    { value: 'mistral', label: 'Mistral AI', icon: 'assets/icons/mistral.svg' },
    { value: 'cohere', label: 'Cohere', icon: 'assets/icons/cohere.svg' },
    { value: 'deepseek', label: 'DeepSeek', icon: 'assets/icons/deepseek.svg' },
    { value: 'ollama', label: 'Ollama', icon: 'assets/icons/ollama.svg' },
    { value: 'custom', label: 'Custom', icon: 'assets/icons/custom.svg' }
  ];

  constructor(
    private fb: FormBuilder,
    private toast: ToastService,
    private spinner: SpinnerService,
    private AiSettingService: AiSettingService,
    private authService: AuthService,
  ) {
    this.connectionForm = this.fb.group({
      provider: ['', Validators.required],
      api_key: ['', Validators.required],
      base_url: ['', null],
      model: ['', Validators.required],
      // timeout: [30, [Validators.required, Validators.min(1)]],
      // retry_count: [3, [Validators.required, Validators.min(0)]],
      temperature: [0.7, [ Validators.min(0), Validators.max(2)]],
      max_tokens: [1500, [ Validators.min(1), Validators.max(8192)]],
      confidence_threshold: [85, [ Validators.min(0), Validators.max(100)]],
      similarity_threshold: [80, [ Validators.min(0), Validators.max(100)]],
    });
  }

  ngOnInit(): void {
    this.token = this.authService.getToken();
  }

  showList(): void {
    this.viewMode.set('list');
  }

  showForm(): void {
    this.isConnectionVerified.set(false);
    this.connectionForm.reset({
      provider: '',
      api_key: '',
      base_url: '',
      model: '',
      temperature: 0.7,
      max_tokens: 1500,
      confidence_threshold: 85,
      similarity_threshold: 80,
    });
    this.models = [];
    this.viewMode.set('form');
  }

  onEditConnection(_id: string): void {
    // API wiring will go here
    this.viewMode.set('form');
  }

  onDeleteConnection(_id: string): void {
    // API wiring will go here
  }

  isInvalid(controlName: string): boolean {
    const control = this.connectionForm.get(controlName);
    return !!(control && control.touched && control.invalid);
  }

  controlValue(controlName: string): number {
    return Number(this.connectionForm.get(controlName)?.value ?? 0);
  }

  sliderProgress(controlName: string, max: number): string {
    const clamped = Math.min(Math.max(this.controlValue(controlName), 0), max);
    return `${(clamped / max) * 100}%`;
  }

  onSliderBoxInput(controlName: string, event: Event, min: number, max: number): void {
    const rawText = (event.target as HTMLInputElement).value.replace(/%/g, '').trim();
    const raw = Number(rawText);
    if (Number.isNaN(raw)) {
      return;
    }
    const value = Math.min(Math.max(raw, min), max);
    this.connectionForm.get(controlName)?.setValue(value);
  }

  fetchAiModal(): void {
    const provider = this.connectionForm.get('provider')?.value;
    const api_key = this.connectionForm.get('api_key')?.value;

    if (!provider || !api_key) {
      return;
    }
    const payload = {
      provider:provider,
      api_key:api_key
    }
     this.AiSettingService.getAiModals(payload).subscribe({
    next: (res: any) => {
      if (res.success) {
        console.log('res103',res.data);
        this.models = res.data;
      } else {
        console.error(res.message);
      }
    },
    error: (err) => {
      console.error('Failed to fetch AI models:', err);
    }
  });
  }

  testConnection(): void {
  if (this.connectionForm.invalid) {
    this.connectionForm.markAllAsTouched();
    this.toast.error('Please fill all required fields');
    return;
  }

  if (this.isTesting()) {
    return;
  }

  this.isTesting.set(true);

  const payload = {
    provider: this.connectionForm.value.provider,
    api_key: this.connectionForm.value.api_key
  };
   this.spinner.show()
  this.AiSettingService.testConnection(payload).subscribe({
    next: (res: any) => {
      this.isTesting.set(false);

      if (res.success) {
        this.isConnectionVerified.set(true);
        this.toast.success('Connection successful.');
        this.spinner.hide()
      } else {
        this.isConnectionVerified.set(false);
        this.toast.error(res.message);
        this.spinner.hide()
      }
    },
    error: (err) => {
      this.isTesting.set(false);
      this.isConnectionVerified.set(false);
      this.spinner.hide()

      this.toast.error(
        err.error?.message || 'Unable to connect to AI provider.'
      );
    }
  });
}

  connectionFormSubmit(formdata:any): void {
    if (!this.connectionForm.valid) {
      this.connectionForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }

    if (this.isSaving() || this.isTesting()) {
      return;
    }
    console.log('this.token',this.token);
    
    formdata.company_id = this.token?.company_id ?? null,
    formdata.user_id = this.token?.id ?? null,
    this.spinner.show()
    this.AiSettingService.addAiSettings(formdata).subscribe({
     next: (res: any) => {
      if (res.success) {
        this.toast.success(res.message);
        this.spinner.hide()
      } else {
        this.toast.error(res.message);
        this.spinner.hide()
      }
    },
    error: (err) => {
      this.isTesting.set(false);
      this.isConnectionVerified.set(false);
      this.spinner.hide()

      this.toast.error(
        err.error?.message || 'Unable to connect to AI provider.'
      );
    }
    })

    // this.isSaving.set(true);
    // // API wiring will go here
    // setTimeout(() => {
    //   this.isSaving.set(false);
    //   this.toast.success('Save connection is ready to be wired to the API');
    // }, 600);
  }
}
