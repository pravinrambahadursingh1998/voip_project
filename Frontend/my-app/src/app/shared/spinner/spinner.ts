import { Component, inject } from '@angular/core';
import { SpinnerService } from './spinner.service';

@Component({
  selector: 'app-spinner',
  standalone: true,
  templateUrl: './spinner.html',
  styleUrl: './spinner.css',
})
export class SpinnerComponent {
  private readonly spinner = inject(SpinnerService);

  readonly visible = this.spinner.visible;
  readonly percent = this.spinner.percent;
}
