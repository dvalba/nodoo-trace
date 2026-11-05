import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../core/auth.service';

const DEMO_ACCOUNTS = [
  { email: 'finca@demo.nodoo.local', label: 'Finca El Roble', role: 'Proveedor' },
  { email: 'tostaduria@demo.nodoo.local', label: 'Tostaduría Aroma', role: 'Fabricante' },
  { email: 'distribuciones@demo.nodoo.local', label: 'Distribuciones Andina', role: 'Mayorista' },
  { email: 'caferias@demo.nodoo.local', label: 'Cafeterías La Vela', role: 'Minorista' },
];

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-sm">
        <div class="text-2xl font-semibold tracking-tight mb-1">NodooTrace</div>
        <p class="text-mut text-sm mb-6">Inicia sesión para trazar tus productos.</p>

        <form (ngSubmit)="submit()" class="space-y-4" [class.space-y-4]="">
          <div>
            <label class="block text-sm mb-1" for="email">Correo</label>
            <input
              id="email"
              name="email"
              [(ngModel)]="email"
              type="email"
              autocomplete="username"
              class="field"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label class="block text-sm mb-1" for="password">Contraseña</label>
            <input
              id="password"
              name="password"
              [(ngModel)]="password"
              type="password"
              autocomplete="current-password"
              class="field"
              placeholder="••••••••"
            />
          </div>

          @if (error()) {
            <div class="text-sm" style="color: #f08a8a">{{ error() }}</div>
          }

          <button type="submit" [disabled]="busy()" class="btn-primary w-full">
            {{ busy() ? 'Iniciando sesión…' : 'Iniciar sesión' }}
          </button>
        </form>

        <div class="mt-8">
          <div class="text-xs uppercase tracking-wide text-mut mb-3">Cuentas de prueba</div>
          <div class="grid gap-2">
            @for (account of demoAccounts; track account.email) {
              <button
                type="button"
                (click)="fill(account.email)"
                [disabled]="busy()"
                class="demo-row"
              >
                <span class="text-sm">{{ account.label }}</span>
                <span class="text-xs text-mut">{{ account.role }}</span>
              </button>
            }
          </div>
          <p class="text-xs text-mut mt-3">Contraseña de todas las cuentas de prueba: Demo1234</p>
        </div>
      </div>
    </div>
  `,
  styles: `
    .field {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-ink);
      font-size: 0.875rem;
    }
    .field:focus {
      outline: none;
      border-color: var(--color-accent);
    }
    .btn-primary {
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      background: var(--color-accent);
      color: var(--color-accent-ink);
      font-size: 0.875rem;
      font-weight: 600;
      transition: opacity 0.15s ease;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .demo-row {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-ink);
      font-size: 0.875rem;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .demo-row:hover {
      border-color: var(--color-accent);
      background: var(--color-surface-2);
    }
    .demo-row:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
})
export class Login implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly demoAccounts = DEMO_ACCOUNTS;

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/']);
    }
  }

  fill(email: string): void {
    this.email = email;
    this.password = 'Demo1234';
    this.submit();
  }

  submit(): void {
    if (!this.email.trim() || !this.password) {
      this.error.set('Ingresa tu correo y contraseña.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);

    this.auth
      .login(this.email.trim(), this.password)
      .then(() => void this.router.navigate(['/']))
      .catch((err: unknown) => {
        const payload = (err as { error?: { message?: unknown } })?.error;
        const message =
          typeof payload?.message === 'string'
            ? payload.message
            : 'Credenciales inválidas.';
        this.error.set(message);
      })
      .finally(() => this.busy.set(false));
  }
}
