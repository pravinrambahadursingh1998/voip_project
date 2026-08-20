import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface RoleStat {
  role: string;
  count: number;
  percent: number;
}

interface ActivityItem {
  id: number;
  user: string;
  action: string;
  time: string;
  tone: 'success' | 'warning' | 'info' | 'danger';
}

interface RecentUser {
  id: number;
  full_name: string;
  role: string;
  status: 'Active' | 'Inactive' | 'Invited';
  last_login: string;
}

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-dashboard.html',
  styleUrl: './user-dashboard.css',
})
export class UserDashboardComponent {
  readonly totalUsers = 48;
  readonly activeUsers = 36;
  readonly invitedUsers = 5;
  readonly inactiveUsers = 7;
  readonly adminUsers = 4;
  readonly onlineNow = 12;

  readonly roleStats: RoleStat[] = [
    { role: 'Agent', count: 28, percent: 58 },
    { role: 'Supervisor', count: 9, percent: 19 },
    { role: 'Viewer', count: 7, percent: 15 },
    { role: 'Admin', count: 4, percent: 8 },
  ];

  readonly recentActivity: ActivityItem[] = [
    {
      id: 1,
      user: 'Alex Morgan',
      action: 'Updated role permissions for Supervisors',
      time: '12 min ago',
      tone: 'info',
    },
    {
      id: 2,
      user: 'Priya Shah',
      action: 'Invited Casey Nguyen as Viewer',
      time: '45 min ago',
      tone: 'success',
    },
    {
      id: 3,
      user: 'Jordan Lee',
      action: 'Signed in from extension 1044',
      time: '1 hr ago',
      tone: 'success',
    },
    {
      id: 4,
      user: 'Sam Rivera',
      action: 'Account marked Inactive',
      time: '3 hr ago',
      tone: 'warning',
    },
    {
      id: 5,
      user: 'System',
      action: 'Failed login attempt for tbrooks',
      time: '5 hr ago',
      tone: 'danger',
    },
  ];

  readonly recentUsers: RecentUser[] = [
    {
      id: 6,
      full_name: 'Taylor Brooks',
      role: 'Agent',
      status: 'Active',
      last_login: 'Today, 11:20 AM',
    },
    {
      id: 5,
      full_name: 'Casey Nguyen',
      role: 'Viewer',
      status: 'Invited',
      last_login: 'Never',
    },
    {
      id: 3,
      full_name: 'Jordan Lee',
      role: 'Agent',
      status: 'Active',
      last_login: 'Today, 08:05 AM',
    },
    {
      id: 2,
      full_name: 'Priya Shah',
      role: 'Supervisor',
      status: 'Active',
      last_login: 'Yesterday, 04:32 PM',
    },
  ];

  constructor(private router: Router) {}

  goToUsers(): void {
    this.router.navigate(['/management/users']);
  }

  addUser(): void {
    this.router.navigate(['/management/users/add']);
  }

  editUser(id: number): void {
    this.router.navigate(['/management/users/edit', id]);
  }

  statusBadgeClass(status: RecentUser['status']): string {
    switch (status) {
      case 'Active':
        return 'user-dash__badge user-dash__badge--active';
      case 'Inactive':
        return 'user-dash__badge user-dash__badge--inactive';
      case 'Invited':
        return 'user-dash__badge user-dash__badge--invited';
      default:
        return 'user-dash__badge';
    }
  }

  activityToneClass(tone: ActivityItem['tone']): string {
    return `user-dash__activity-dot user-dash__activity-dot--${tone}`;
  }
}
