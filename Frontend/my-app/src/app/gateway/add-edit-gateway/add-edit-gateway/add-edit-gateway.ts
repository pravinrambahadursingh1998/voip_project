import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { GatewayService } from '../../../services/gateway_service/gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { SpinnerService } from '../../../shared/spinner/spinner.service';

@Component({
  selector: 'app-add-edit-gateway',
  imports: [CommonModule, ReactiveFormsModule, MatProgressSpinnerModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './add-edit-gateway.html',
  styleUrl: './add-edit-gateway.css',
  standalone: true,
})
export class AddEditGatewayComponent implements OnInit {
  gatewayForm!: FormGroup;
  readonly isLoading = signal(false);
  token : any;
  id : any;
  constructor(
    private fb: FormBuilder,
    private gatewayService: GatewayService,
    private toast: ToastService,
    private router: Router,
    private authService: AuthService,
    private activatedRoute: ActivatedRoute,
    private spinner: SpinnerService
  ) {
    this.gatewayForm = this.fb.group({
      gateway_name: ['', Validators.required],
      enabled: [''],
      description: [''],
      proxy: ['', Validators.required],
      realm: [''],
      register_transport: [''],
      register: [''],
      user_name: ['', Validators.required],
      gateway_password: ['', Validators.required],
      from_user: [''],
      from_domain: [''],
    });
  }

  ngOnInit(): void {
    this.token = this.authService.getToken();
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
    if (this.id) {
      this.isLoading.set(true);
      this.getSingleGatewayDetails();
      this.isLoading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/gateways']);
  }

  getSingleGatewayDetails(): void {
    this.gatewayService.getSingleGateway(this.id).subscribe({
      next: (response: any) => {
        this.gatewayForm.patchValue({
          gateway_name: response.data.gateway_name,
          enabled: response.data.enabled,
          description: response.data.description,
          proxy: response.data.proxy,
          realm: response.data.realm,
          // register_transport: response.data.register_transport == 1 ? 'udp' : response.data.register_transport == 2 ? 'tcp' : 'tls',
          register_transport : response.data.register_transport,
          register: response.data.register,
          user_name: response.data.username,
          gateway_password: response.data.password,
          from_user: response.data.from_user,
          from_domain: response.data.from_domain,
        });
      },
      error: (error: any) => {
        this.toast.error(error?.error?.message || 'Something went wrong');
      }
    });
  }
  gatewayFormSubmit(formValue: any): void {
    if (!this.gatewayForm.valid) {
      this.gatewayForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }

    if (this.isLoading()) {
      return;
    }

    // this.isLoading.set(true);

    // const session = JSON.parse(localStorage.getItem('session') || '{}');
    const payload = {
      ...formValue,
      user_id: this.token?.user?.id ?? null,
      company_id: this.token?.company?.id ?? null,
    };
    this.spinner.show()

    this.gatewayService
      .addGateway(payload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.toast.success(response.message || 'Gateway created successfully');
             this.spinner.hide()
            this.gatewayForm.reset();
            this.gatewayForm.markAsPristine();
            this.gatewayForm.markAsUntouched();
            this.router.navigate(['/gateways']);
          } else {
            this.spinner.hide()
            this.toast.error(response.message || 'Failed to create gateway');
          }
        },
        error: (error: any) => {
          this.spinner.hide()
          this.toast.error(error?.error?.message || 'Something went wrong');
        },
      });
  }

 
}
