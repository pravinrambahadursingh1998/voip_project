import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from '../shared/sidebar/sidebar';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class LayoutComponent {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  readonly sidebarCollapsed = signal(false);
  readonly breadcrumb = signal('');
  readonly profileMenuOpen = signal(false);

  private readonly sessionUser = signal<Record<string, unknown> | null>(null);

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

  readonly userEmail = computed(() => {
    const email = this.sessionUser()?.['email'];
    return email ? String(email) : '';
  });

  constructor() {
    this.loadSessionUser();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.profileMenuOpen.set(false);
        this.updateBreadcrumb();
      });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.profileMenuOpen()) {
      this.profileMenuOpen.set(false);
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => !value);
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((open) => !open);
    if (!this.profileMenuOpen()) {
      return;
    }
    this.loadSessionUser();
  }

  goToProfile(): void {
    this.profileMenuOpen.set(false);
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.profileMenuOpen.set(false);
    this.authService.logout().subscribe({
      next: () => this.clearSessionAndRedirect(),
      error: () => this.clearSessionAndRedirect(),
    });
  }

  private clearSessionAndRedirect(): void {
    localStorage.removeItem('session');
    this.sessionUser.set(null);
    this.router.navigate(['/login']);
  }

  private loadSessionUser(): void {
    this.sessionUser.set(this.authService.getToken());
  }

  private updateBreadcrumb(): void {
    let route: ActivatedRoute | null = this.activatedRoute;

    while (route?.firstChild) {
      route = route.firstChild;
    }

    const data = route?.snapshot?.data;
    this.breadcrumb.set(data?.['breadcrumb'] ?? '');
  }
}
