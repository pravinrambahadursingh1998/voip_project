import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-add-edit-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatProgressSpinnerModule],
  templateUrl: './add-edit-user.html',
  styleUrl: './add-edit-user.css',
})
export class AddEditUserComponent implements OnInit {
  userForm!: FormGroup;
  readonly isLoading = signal(false);
  readonly isEditMode = signal(false);
  private userId: string | null = null;

  private readonly mockUsers: Record<
    string,
    {
      full_name: string;
      email: string;
      username: string;
      role: string;
      status: string;
      extension: string;
      phone: string;
      password: string;
    }
  > = {
    '1': {
      full_name: 'Alex Morgan',
      email: 'alex.morgan@pbxbridge.com',
      username: 'amorgan',
      role: 'Admin',
      status: 'Active',
      extension: '1001',
      phone: '+1 555 0101',
      password: '',
    },
    '2': {
      full_name: 'Priya Shah',
      email: 'priya.shah@pbxbridge.com',
      username: 'pshah',
      role: 'Supervisor',
      status: 'Active',
      extension: '1012',
      phone: '+1 555 0112',
      password: '',
    },
    '3': {
      full_name: 'Jordan Lee',
      email: 'jordan.lee@pbxbridge.com',
      username: 'jlee',
      role: 'Agent',
      status: 'Active',
      extension: '1044',
      phone: '+1 555 0144',
      password: '',
    },
    '4': {
      full_name: 'Sam Rivera',
      email: 'sam.rivera@pbxbridge.com',
      username: 'srivera',
      role: 'Agent',
      status: 'Inactive',
      extension: '1050',
      phone: '+1 555 0150',
      password: '',
    },
    '5': {
      full_name: 'Casey Nguyen',
      email: 'casey.nguyen@pbxbridge.com',
      username: 'cnguyen',
      role: 'Viewer',
      status: 'Invited',
      extension: '',
      phone: '',
      password: '',
    },
    '6': {
      full_name: 'Taylor Brooks',
      email: 'taylor.brooks@pbxbridge.com',
      username: 'tbrooks',
      role: 'Agent',
      status: 'Active',
      extension: '1061',
      phone: '+1 555 0161',
      password: '',
    },
  };

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private toast: ToastService
  ) {
    this.userForm = this.fb.group({
      full_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      username: ['', Validators.required],
      role: ['Agent', Validators.required],
      status: ['Active', Validators.required],
      extension: [''],
      phone: [''],
      password: [''],
    });
  }

  ngOnInit(): void {
    this.userId = this.activatedRoute.snapshot.paramMap.get('id');
    this.isEditMode.set(!!this.userId);

    if (this.isEditMode()) {
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
      this.patchUser();
    } else {
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('password')?.updateValueAndValidity();
    }
  }

  get pageTitle(): string {
    return this.isEditMode() ? 'Edit user' : 'Add a user';
  }

  get pageSubtitle(): string {
    return this.isEditMode()
      ? 'Update profile details and access for this account.'
      : 'Invite a teammate and assign their role and extension.';
  }

  goBack(): void {
    this.router.navigate(['/management/users']);
  }

  private patchUser(): void {
    if (!this.userId) {
      return;
    }

    const user = this.mockUsers[this.userId];
    if (!user) {
      this.toast.error('User not found');
      this.goBack();
      return;
    }

    this.userForm.patchValue(user);
  }

  submitUser(): void {
    if (!this.userForm.valid) {
      this.userForm.markAllAsTouched();
      this.toast.error('Please fill all required fields');
      return;
    }

    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);

    // UI-only save — no API call
    setTimeout(() => {
      this.isLoading.set(false);
      this.toast.success(
        this.isEditMode() ? 'User updated (UI only)' : 'User created (UI only)'
      );
      this.goBack();
    }, 600);
  }
}
