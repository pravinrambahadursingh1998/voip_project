import { Routes } from '@angular/router';

export const MANAGEMENT_ROUTES: Routes = [
  {
    path: 'management/dashboard',
    loadComponent: () =>
      import('./user-dashboard/user-dashboard').then(
        (m) => m.UserDashboardComponent
      ),
    data: {
      title: 'User Dashboard',
      breadcrumb: 'Management / Dashboard',
    },
  },
  {
    path: 'management/users',
    loadComponent: () =>
      import('./user-management/user-management').then(
        (m) => m.UserManagementComponent
      ),
    data: {
      title: 'Users',
      breadcrumb: 'Management / Users',
    },
  },
  {
    path: 'management/users/add',
    loadComponent: () =>
      import('./add-edit-user/add-edit-user').then(
        (m) => m.AddEditUserComponent
      ),
    data: {
      title: 'Add User',
      breadcrumb: 'Management / Users / Add User',
    },
  },
  {
    path: 'management/users/edit/:id',
    loadComponent: () =>
      import('./add-edit-user/add-edit-user').then(
        (m) => m.AddEditUserComponent
      ),
    data: {
      title: 'Edit User',
      breadcrumb: 'Management / Users / Edit User',
    },
  },
];
