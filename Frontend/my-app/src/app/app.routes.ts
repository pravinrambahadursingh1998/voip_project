import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './auth/auth.routes';
import { DASHBOARD_ROUTES } from './dashboard/dashboard.routes';
import { GATEWAY_ROUTES } from './gateway/gateway.routes';
import { AI_CONNECTION_ROUTES } from './ai_setup/ai-connection.routes';
import { MANAGEMENT_ROUTES } from './management/management.routes';
import { PROFILE_ROUTES } from './profile/profile.routes';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  ...AUTH_ROUTES,
  {
    path: '',
    loadComponent: () =>
      import('./layout/layout').then((m) => m.LayoutComponent),
    children: [
      ...DASHBOARD_ROUTES,
      ...GATEWAY_ROUTES,
      ...AI_CONNECTION_ROUTES,
      ...MANAGEMENT_ROUTES,
      ...PROFILE_ROUTES,
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
