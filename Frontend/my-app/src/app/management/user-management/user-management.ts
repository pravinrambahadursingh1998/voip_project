import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PaginationComponent } from '../../shared/pagination/pagination';
import { ToastService } from '../../shared/toast/toast.service';

export interface ManagedUser {
  id: number;
  full_name: string;
  email: string;
  username: string;
  role: 'Admin' | 'Agent' | 'Supervisor' | 'Viewer';
  status: 'Active' | 'Inactive' | 'Invited';
  extension: string;
  last_login: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  templateUrl: './user-management.html',
  styleUrl: './user-management.css',
  imports: [CommonModule, FormsModule, PaginationComponent],
})
export class UserManagementComponent implements OnInit {
  users: ManagedUser[] = [];
  filteredUsers: ManagedUser[] = [];
  pagedUsers: ManagedUser[] = [];

  currentPage = 1;
  pageSize = 50;
  searchTerm = '';
  statusFilter = '';

  filters = {
    full_name: '',
    email: '',
    username: '',
    role: '',
    status: '',
    extension: '',
  };

  constructor(
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  get activeCount(): number {
    return this.users.filter((u) => u.status === 'Active').length;
  }

  get inactiveCount(): number {
    return this.users.filter((u) => u.status === 'Inactive').length;
  }

  get invitedCount(): number {
    return this.users.filter((u) => u.status === 'Invited').length;
  }

  loadUsers(): void {
    this.users = [
      {
        id: 1,
        full_name: 'Alex Morgan',
        email: 'alex.morgan@pbxbridge.com',
        username: 'amorgan',
        role: 'Admin',
        status: 'Active',
        extension: '1001',
        last_login: 'Today, 09:14 AM',
      },
      {
        id: 2,
        full_name: 'Priya Shah',
        email: 'priya.shah@pbxbridge.com',
        username: 'pshah',
        role: 'Supervisor',
        status: 'Active',
        extension: '1012',
        last_login: 'Yesterday, 04:32 PM',
      },
      {
        id: 3,
        full_name: 'Jordan Lee',
        email: 'jordan.lee@pbxbridge.com',
        username: 'jlee',
        role: 'Agent',
        status: 'Active',
        extension: '1044',
        last_login: 'Today, 08:05 AM',
      },
      {
        id: 4,
        full_name: 'Sam Rivera',
        email: 'sam.rivera@pbxbridge.com',
        username: 'srivera',
        role: 'Agent',
        status: 'Inactive',
        extension: '1050',
        last_login: 'Mar 12, 2026',
      },
      {
        id: 5,
        full_name: 'Casey Nguyen',
        email: 'casey.nguyen@pbxbridge.com',
        username: 'cnguyen',
        role: 'Viewer',
        status: 'Invited',
        extension: '—',
        last_login: 'Never',
      },
      {
        id: 6,
        full_name: 'Taylor Brooks',
        email: 'taylor.brooks@pbxbridge.com',
        username: 'tbrooks',
        role: 'Agent',
        status: 'Active',
        extension: '1061',
        last_login: 'Today, 11:20 AM',
      },
    ];

    this.applyFilters();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePagedUsers();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.updatePagedUsers();
  }

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();
    const statusSelect = this.statusFilter.trim().toLowerCase();
    const name = this.filters.full_name.trim().toLowerCase();
    const email = this.filters.email.trim().toLowerCase();
    const username = this.filters.username.trim().toLowerCase();
    const role = this.filters.role.trim().toLowerCase();
    const status = this.filters.status.trim().toLowerCase();
    const extension = this.filters.extension.trim().toLowerCase();

    this.filteredUsers = this.users.filter((user) => {
      const haystack = [
        user.full_name,
        user.email,
        user.username,
        user.role,
        user.status,
        user.extension,
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !search || haystack.includes(search);
      const matchesStatusSelect =
        !statusSelect || user.status.toLowerCase() === statusSelect;
      const matchesName = !name || user.full_name.toLowerCase().includes(name);
      const matchesEmail = !email || user.email.toLowerCase().includes(email);
      const matchesUsername =
        !username || user.username.toLowerCase().includes(username);
      const matchesRole = !role || user.role.toLowerCase().includes(role);
      const matchesStatus =
        !status || user.status.toLowerCase().includes(status);
      const matchesExtension =
        !extension || user.extension.toLowerCase().includes(extension);

      return (
        matchesSearch &&
        matchesStatusSelect &&
        matchesName &&
        matchesEmail &&
        matchesUsername &&
        matchesRole &&
        matchesStatus &&
        matchesExtension
      );
    });

    this.updatePagedUsers();
  }

  updatePagedUsers(): void {
    const totalPages = Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedUsers = this.filteredUsers.slice(start, start + this.pageSize);
  }

  addUser(): void {
    this.router.navigate(['/management/users/add']);
  }

  editUser(id: number): void {
    this.router.navigate(['/management/users/edit', id]);
  }

  deleteUser(user: ManagedUser): void {
    this.users = this.users.filter((u) => u.id !== user.id);
    this.applyFilters();
    this.toast.success(`${user.full_name} removed (UI only)`);
  }

  refreshUsers(): void {
    this.loadUsers();
    this.toast.info('User list refreshed');
  }

  statusBadgeClass(status: ManagedUser['status']): string {
    switch (status) {
      case 'Active':
        return 'users__badge users__badge--active';
      case 'Inactive':
        return 'users__badge users__badge--inactive';
      case 'Invited':
        return 'users__badge users__badge--invited';
      default:
        return 'users__badge';
    }
  }
}
