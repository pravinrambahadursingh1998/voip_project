import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
})
export class PaginationComponent {
  /** Total number of items across all pages */
  readonly totalItems = input(0);
  /** Items shown per page */
  readonly pageSize = input(10);
  /** 1-based current page */
  readonly currentPage = input(1);
  /** Label used in "Showing X to Y of Z {itemLabel}" */
  readonly itemLabel = input('entries');
  /** Available page-size options for the left dropdown */
  readonly pageSizeOptions = input<number[]>([10, 25, 50, 100]);
  /** Max page number buttons to show */
  readonly maxVisiblePages = input(5);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly totalPages = computed(() => {
    const size = this.pageSize();
    const total = this.totalItems();
    if (size <= 0 || total <= 0) {
      return 1;
    }
    return Math.ceil(total / size);
  });

  readonly startItem = computed(() => {
    if (this.totalItems() === 0) {
      return 0;
    }
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly endItem = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.totalItems()),
  );

  readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const maxVisible = this.maxVisiblePages();
    const half = Math.floor(maxVisible / 2);

    let start = Math.max(1, current - half);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const result: number[] = [];
    for (let page = start; page <= end; page++) {
      result.push(page);
    }
    return result;
  });

  readonly canGoPrev = computed(() => this.currentPage() > 1);
  readonly canGoNext = computed(() => this.currentPage() < this.totalPages());

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.pageChange.emit(page);
  }

  prev(): void {
    this.goToPage(this.currentPage() - 1);
  }

  next(): void {
    this.goToPage(this.currentPage() + 1);
  }

  onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value) || value <= 0 || value === this.pageSize()) {
      return;
    }
    this.pageSizeChange.emit(value);
  }
}
