import { Routes } from '@angular/router';

export const PROFILE_ROUTES: Routes = [
  {
    path: 'profile',
    loadComponent: () =>
      import('./user-profile/user-profile').then((m) => m.UserProfileComponent),
    data: {
      title: 'User Profile',
      breadcrumb: 'Home / User Profile',
    },
  },
];
