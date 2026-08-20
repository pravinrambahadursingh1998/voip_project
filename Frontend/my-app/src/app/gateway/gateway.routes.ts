import { Routes } from '@angular/router';
import { authGuard } from '../guards/auth.guard';

export const GATEWAY_ROUTES: Routes = [
  {
    path: 'gateways',
    // canActivate: [authGuard],
    loadComponent: () =>
      import('./gateway').then((m) => m.GatewayComponent),
    data: {
      title: 'Gateways',
      breadcrumb: 'Gateways',
    },
  },
  {
    path: 'gateway/add-gateway',
    // canActivate: [authGuard],
    loadComponent: () =>
      import('./add-edit-gateway/add-edit-gateway/add-edit-gateway').then(
        (m) => m.AddEditGatewayComponent
      ),
    data: {
      title: 'Add Gateway',
      breadcrumb: 'Gateways / Add Gateway',
    },
  },
  {
    path: 'gateway/edit-gateway/:id',
    // canActivate: [authGuard],
    loadComponent: () =>
      import('./add-edit-gateway/add-edit-gateway/add-edit-gateway').then(
        (m) => m.AddEditGatewayComponent
      ),
    data: {
      title: 'Update Gateway',
      breadcrumb: 'Gateways / Update Gateway',
    },
  },
];
