import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';
import { SpinnerService } from '../../shared/spinner/spinner.service';
import { finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CommonModule],
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit {
  rememberDevice: any;
  loginForm!: FormGroup;
  error: string = '';
  readonly isLoading = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toast: ToastService,
    private spinner: SpinnerService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberDevice: [false],
    });
  }

  ngOnInit(): void {}

  onSubmit(data: any): void {
    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      this.error = 'Please fill all the fields';
      this.toast.error('Please fill all the fields');
      return;
    }

    if (this.isLoading()) {
      return;
    }

    this.error = '';
    this.isLoading.set(true);
    this.spinner.show();

    this.authService
      .login(data)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.spinner.hide();
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            const session = {
              token: response.token,
              user: response.data,
            };
            localStorage.setItem('session', JSON.stringify(session));
            this.toast.success(response.message || 'Login successful');
            this.router.navigate(['/dashboard']);
          } else {
            this.error = response.message;
            this.toast.error(response.message || 'Login failed');
          }
        },
        error: (err) => {
          const message = err?.error?.message || 'Unable to sign in. Please try again.';
          this.error = message;
          this.toast.error(message);
        },
      });
  }
}
