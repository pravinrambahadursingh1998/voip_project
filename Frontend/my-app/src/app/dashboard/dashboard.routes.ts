import { Routes } from '@angular/router';
import {authGuard} from '../guards/auth.guard'

export const DASHBOARD_ROUTES: Routes = [
  {
    path: 'dashboard',
    // canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard').then((m) => m.DashboardComponent),
    data: {
      title: 'Dashboard',
      breadcrumb: 'Dashboard',
    },
  },
];
