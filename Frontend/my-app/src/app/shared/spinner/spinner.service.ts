import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SpinnerService {
  private readonly _visible = signal(false);
  private readonly _percent = signal(0);
  private timerId: ReturnType<typeof setInterval> | null = null;

  readonly visible = this._visible.asReadonly();
  readonly percent = this._percent.asReadonly();

  /** Show the percentage spinner (auto-counts toward 90% while waiting). */
  show(): void {
    this.clearTimer();
    this._percent.set(0);
    this._visible.set(true);

    this.timerId = setInterval(() => {
      const current = this._percent();
      if (current >= 90) {
        return;
      }
      const step = current < 40 ? 3 : current < 70 ? 2 : 1;
      this._percent.set(Math.min(90, current + step));
    }, 120);
  }

  /** Complete to 100% briefly, then hide. */
  hide(): void {
    this.clearTimer();
    this._percent.set(100);

    setTimeout(() => {
      this._visible.set(false);
      this._percent.set(0);
    }, 280);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
