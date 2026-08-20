import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/toast/toast';
import { SpinnerComponent } from './shared/spinner/spinner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, SpinnerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('my-app');
}
