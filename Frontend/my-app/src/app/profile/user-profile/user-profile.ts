import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';

type ProfileTab = 'settings' | 'password';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css',
})
export class UserProfileComponent {
  private readonly authService = inject(AuthService);

  readonly activeTab = signal<ProfileTab>('settings');
  readonly selectedFileName = signal('No file chosen');

  private readonly sessionUser = signal<Record<string, unknown> | null>(
    this.authService.getToken()
  );

  readonly displayName = computed(() => {
    const user = this.sessionUser();
    if (!user) {
      return 'User';
    }

    const first = String(user['first_name'] ?? '').trim();
    const last = String(user['last_name'] ?? '').trim();
    const fullName = [first, last].filter(Boolean).join(' ');
    if (fullName) {
      return fullName;
    }

    return String(user['username'] ?? user['email'] ?? 'User');
  });

  readonly userInitials = computed(() => {
    const user = this.sessionUser();
    if (!user) {
      return 'U';
    }

    const first = String(user['first_name'] ?? '').trim();
    const last = String(user['last_name'] ?? '').trim();
    if (first || last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || first.slice(0, 2).toUpperCase();
    }

    const username = String(user['username'] ?? user['email'] ?? 'U');
    return username.slice(0, 2).toUpperCase();
  });

  readonly roleLabel = computed(() => {
    const user = this.sessionUser();
    const role = user?.['role'] ?? user?.['user_type'] ?? user?.['designation'];
    return role ? String(role) : 'User';
  });

  firstName = '';
  lastName = '';
  address = '';
  email = '';
  mobile = '';
  country = 'India';
  state = '';
  city = '';

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  constructor() {
    this.hydrateFromSession();
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.selectedFileName.set(file?.name ?? 'No file chosen');
  }

  onUpdateProfile(): void {
    // UI only — no API call
  }

  onChangePassword(): void {
    // UI only — no API call
  }

  private hydrateFromSession(): void {
    const user = this.sessionUser();
    if (!user) {
      return;
    }

    this.firstName = String(user['first_name'] ?? '').trim();
    this.lastName = String(user['last_name'] ?? '').trim();
    this.email = String(user['email'] ?? '').trim();
    this.mobile = String(user['mobile'] ?? user['phone'] ?? '').trim();
    this.address = String(user['address'] ?? '').trim();
    this.country = String(user['country'] ?? 'India').trim() || 'India';
    this.state = String(user['state'] ?? '').trim();
    this.city = String(user['city'] ?? '').trim();
  }
}
