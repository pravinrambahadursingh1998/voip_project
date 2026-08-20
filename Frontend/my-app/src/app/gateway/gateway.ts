import { ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { AuthService } from '../services/auth';
import { Router } from '@angular/router';
import { ToastService } from '../shared/toast/toast.service';
import { GatewayService } from '../services/gateway_service/gateway';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PaginationComponent } from '../shared/pagination/pagination';

@Component({
  selector: 'app-gateway',
  standalone: true,
  templateUrl: './gateway.html',
  styleUrl: './gateway.css',
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule, PaginationComponent],
})
export class GatewayComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router,
    private toast: ToastService,
    private gatewayService: GatewayService,
    private cdr: ChangeDetectorRef) { }

  isLoading = signal(false);
  gateways: any[] = [];
  filteredGateways: any[] = [];
  pagedGateways: any[] = [];

  currentPage = 1;
  pageSize = 50;

  filters = {
    gateway_name: '',
    proxy: '',
    username: '',
    gateway_status: '',
  };

  ngOnInit(): void {
    this.getGatewayStatusList();
  }

  getGatewayStatusList(): void {
    this.isLoading.set(true);

    this.gatewayService.getGatewayStatusList().subscribe({
      next: (response: any) => {
        this.gateways = response.data || [];
        this.applyFilters();
        this.isLoading.set(false);
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoading.set(false);
        this.toast.error(error?.message || 'Something went wrong');
        this.cdr.detectChanges();
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePagedGateways();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.updatePagedGateways();
  }

  applyFilters(): void {
    const name = this.filters.gateway_name.trim().toLowerCase();
    const proxy = this.filters.proxy.trim().toLowerCase();
    const username = this.filters.username.trim().toLowerCase();
    const status = this.filters.gateway_status.trim().toLowerCase();

    this.filteredGateways = this.gateways.filter((gateway) => {
      const matchesName = !name || String(gateway.gateway_name ?? '').toLowerCase().includes(name);
      const matchesProxy = !proxy || String(gateway.proxy ?? '').toLowerCase().includes(proxy);
      const matchesUsername = !username || String(gateway.username ?? '').toLowerCase().includes(username);
      const matchesStatus = !status || String(gateway.gateway_status ?? '').toLowerCase().includes(status);
      return matchesName && matchesProxy && matchesUsername && matchesStatus;
    });

    this.updatePagedGateways();
  }

  updatePagedGateways(): void {
    const totalPages = Math.max(1, Math.ceil(this.filteredGateways.length / this.pageSize));
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedGateways = this.filteredGateways.slice(start, start + this.pageSize);
  }

  addGateway(): void {
    this.router.navigate(['/gateway/add-gateway']);
  }

  editGateway(id: any): void {
    this.router.navigate(['/gateway/edit-gateway', id]);
  }
}
