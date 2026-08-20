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
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
import {
  AiFunctionItem,
  AiFunctionParameter,
  AiFunctionPayload,
  emptyFunction,
} from '../../ai-function.models';
import { AiFunctionService } from '../../../../services/ai_function_service/ai-function';
// import { AiFunctionService } from  '../../../../services/'
import { ToastService } from '../../../../shared/toast/toast.service';
import {SpinnerService} from '../../../../shared/spinner/spinner.service'
import { AuthService } from '../../../../services/auth';

@Component({
  selector: 'app-function-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './function-editor.html',
  styleUrl: './function-editor.css',
})
export class FunctionEditor implements OnInit{

 

  private readonly fb = inject(FormBuilder);
  private readonly aiFunctionService = inject(AiFunctionService);
  private readonly toast = inject(ToastService);
  private readonly showSpinner = inject(SpinnerService)
  
  private readonly cd = inject(ChangeDetectorRef)
 

  readonly fn = input.required<AiFunctionItem>();
  readonly selectedId = input<string | null>(null);
  readonly isCreating = input(false);

  readonly saved = output<AiFunctionItem>();
  readonly deleted = output<string>();

  readonly isSaving = signal(false);
  readonly isDeleting = signal(false);
  readonly showParamDraft = signal(false);
  readonly submitted = signal(false);
  token:any
  currentFunctionId: string | null = null

  readonly functionForm: FormGroup = this.fb.group({
    name: [
      '',
      [Validators.required, Validators.pattern(/^[a-z][a-z0-9_]*$/)],
    ],
    method: ['POST', Validators.required],
    description: ['', Validators.required],
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
    type: ['Async', Validators.required],
    direction: ['both', Validators.required],
    timeout: [5000, [Validators.required, Validators.min(1)]],
    enabled: [true],
    auth: [''],
    contentType: ['application/json', Validators.required],
    parameters: this.fb.array([]),
    paramDraft: this.fb.group({
      name: [
        '',
        [Validators.required, Validators.pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/)],
      ],
      type: ['string', Validators.required],
      required: [false],
      description: [''],
    }),
  });

  private syncedId: string | null = null;

  constructor(private authService: AuthService ) {
    this.paramDraft.disable({ emitEvent: false });

    effect(() => {
      const creating = this.isCreating();
      const id = this.selectedId();
      const syncKey = creating ? '__creating__' : id;

      if (this.syncedId === syncKey) {
        return;
      }

      this.syncedId = syncKey;
      this.submitted.set(false);
      this.cancelParamDraft();

      if (creating || !id) {
        this.currentFunctionId = null;
        this.patchFromItem(emptyFunction());
        this.cd.detectChanges();
        return;
      }

      this.getFunctionData(id);
    });
  }
  ngOnInit(): void {
    this.token = this.authService.getToken();
  }

  getFunctionData(id: string): void {
    this.showSpinner.show();
    this.aiFunctionService.getFunction(id).subscribe({
      next: (res) => {
        if (res.success == true && res.data) {
          const item = res.data;
          this.currentFunctionId = item.id;
          this.patchFromItem({
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
          this.toast.error(res.message || 'Failed to load function');
          this.patchFromItem(emptyFunction());
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

  get parameters(): FormArray {
    return this.functionForm.get('parameters') as FormArray;
  }

  get paramDraft(): FormGroup {
    return this.functionForm.get('paramDraft') as FormGroup;
  }

  isInvalid(controlName: string): boolean {
    const control = this.functionForm.get(controlName);
    return !!(
      control &&
      control.invalid &&
      (control.touched || this.submitted())
    );
  }

  isDraftInvalid(controlName: string): boolean {
    const control = this.paramDraft.get(controlName);
    return !!(control && control.invalid && control.touched);
  }

  openParamDraft(): void {
    this.paramDraft.enable({ emitEvent: false });
    this.showParamDraft.set(true);
  }

  cancelParamDraft(): void {
    this.paramDraft.reset(
      {
        name: '',
        type: 'string',
        required: false,
        description: '',
      },
      { emitEvent: false }
    );
    this.paramDraft.markAsPristine();
    this.paramDraft.markAsUntouched();
    this.paramDraft.disable({ emitEvent: false });
    this.showParamDraft.set(false);
  }

  confirmParamDraft(): void {
    if (this.paramDraft.invalid) {
      this.paramDraft.markAllAsTouched();
      this.toast.error('Please fill a valid parameter name');
      return;
    }

    const value = this.paramDraft.getRawValue() as AiFunctionParameter;
    const duplicate = this.parameters.controls.some(
      (ctrl) => ctrl.get('name')?.value === value.name
    );
    if (duplicate) {
      this.toast.error('A parameter with this name already exists');
      return;
    }

    this.parameters.push(this.createParameterGroup(value));
    this.cancelParamDraft();
  }

  removeParameter(index: number): void {
    this.parameters.removeAt(index);
  }

  resetForm(): void {
    if (this.isCreating() || !this.currentFunctionId) {
      this.patchFromItem(emptyFunction());
    } else {
      this.getFunctionData(this.currentFunctionId);
    }
    this.submitted.set(false);
    this.cancelParamDraft();
    this.toast.info('Form reset');
  }

  onDelete(): void {
    const id = this.currentFunctionId || this.selectedId() || this.fn().id;
    if (!id || this.isCreating() || this.isDeleting() || this.isSaving()) {
      return;
    }

    if (!confirm(`Delete function “${this.fn().name}”?`)) {
      return;
    }

    this.isDeleting.set(true);
    this.aiFunctionService
      .deleteFunction(id)
      .pipe(finalize(() => this.isDeleting.set(false)))
      .subscribe({
        next: (response: any) => {
          if (response?.success === false) {
            this.toast.error(response.message || 'Failed to delete function');
            return;
          }
          this.toast.success(response?.message || 'Function deleted');
          this.deleted.emit(id);
        },
        error: (error: any) => {
          this.toast.error(error?.error?.message || 'Something went wrong');
        },
      });
  }

  onSubmit(): void {
    this.submitted.set(true);

    // Commit or dismiss an open draft before validating the main form
    if (this.showParamDraft()) {
      if (this.paramDraft.valid) {
        this.confirmParamDraft();
      } else if (this.paramDraft.get('name')?.value) {
        this.paramDraft.markAllAsTouched();
        this.toast.error('Please finish or cancel the parameter draft');
        return;
      } else {
        this.cancelParamDraft();
      }
    }

    if (this.functionForm.invalid) {
      this.functionForm.markAllAsTouched();
      this.toast.error('Please fill all required fields correctly');
      return;
    }

    if (this.isSaving() || this.isDeleting()) {
      return;
    }

    const payload = this.buildPayload();
    this.isSaving.set(true);
    this.showSpinner.show()
    this.aiFunctionService.createFunction(payload).subscribe({
      next: (response: any) => {
        console.log(response);
        this.showSpinner.hide()
        this.toast.success(response.message)
        this.isSaving.set(false);
        this.cd.detectChanges()
      },
      error: (error: any) => {
        console.error(error);
        this.showSpinner.hide()
        this.toast.error(error.message)
        this.isSaving.set(false);
        this.cd.detectChanges()
      }
    });


    // const request$ = this.isCreating()
    //   ? this.aiFunctionService.createFunction(payload)
    //   : this.aiFunctionService.updateFunction(this.fn().id, payload);

    // request$.pipe(finalize(() => this.isSaving.set(false))).subscribe({
    //   next: (response: any) => {
    //     if (response?.success === false) {
    //       this.toast.error(
    //         response.message ||
    //           (this.isCreating()
    //             ? 'Failed to create function'
    //             : 'Failed to save function')
    //       );
    //       return;
    //     }

    //     this.toast.success(
    //       response?.message ||
    //         (this.isCreating()
    //           ? 'Function created successfully'
    //           : 'Function saved successfully')
    //     );

    //     // const savedItem: AiFunctionItem = {
    //     //   id: response?.data?.id || this.fn().id || payload.name,
    //     //   name: payload.name,
    //     //   description: payload.description,
    //     //   method: payload.method,
    //     //   type: payload.type,
    //     //   url: payload.url,
    //     //   timeout: payload.timeout,
    //     //   enabled: payload.enabled,
    //     //   auth: payload.headers.Authorization,
    //     //   contentType: payload.headers['Content-Type'],
    //     //   parameters: payload.parameters,
    //     // };

    //     // this.syncedId = savedItem.id;
    //     // this.saved.emit(savedItem);
    //     // this.functionForm.markAsPristine();
    //   },
    //   error: (error: any) => {
    //     this.toast.error(error?.error?.message || 'Something went wrong');
    //   },
    // });
  }

  private buildPayload(): AiFunctionPayload {
    const { paramDraft: _draft, ...raw } = this.functionForm.getRawValue();
    return {
      id : this.currentFunctionId ?? raw.id,
      company_id : this.token?.company_id ?? null,
      user_id : this.token?.id ?? null,
      name: String(raw.name).trim(),
      description: String(raw.description).trim(),
      method: raw.method,
      type: raw.type,
      direction: raw.direction || 'both',
      url: String(raw.url).trim(),
      timeout: Number(raw.timeout),
      enabled: !!raw.enabled,
      headers: {
        Authorization: String(raw.auth ?? '').trim(),
        'Content-Type': String(raw.contentType ?? '').trim(),
      },
      parameters: (raw.parameters as AiFunctionParameter[]).map((param) => ({
        name: String(param.name).trim(),
        type: param.type,
        required: !!param.required,
        description: String(param.description ?? '').trim(),
      })),
    };
  }

  private patchFromItem(item: AiFunctionItem): void {
    this.parameters.clear();
    for (const param of item.parameters) {
      this.parameters.push(this.createParameterGroup(param));
    }

    this.functionForm.patchValue(
      {
        name: item.name,
        method: item.method,
        description: item.description,
        url: item.url,
        type: item.type,
        direction: item.direction || 'both',
        timeout: item.timeout,
        enabled: item.enabled,
        auth: item.auth,
        contentType: item.contentType,
        paramDraft: {
          name: '',
          type: 'string',
          required: false,
          description: '',
        },
      },
      { emitEvent: false }
    );

    this.functionForm.markAsPristine();
    this.functionForm.markAsUntouched();
  }

  private createParameterGroup(param: AiFunctionParameter): FormGroup {
    return this.fb.group({
      name: [
        param.name,
        [Validators.required, Validators.pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/)],
      ],
      type: [param.type || 'string', Validators.required],
      required: [!!param.required],
      description: [param.description || ''],
    });
  }
}
