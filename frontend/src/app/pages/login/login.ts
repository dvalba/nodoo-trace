import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-sm">
        <div class="text-2xl font-semibold tracking-tight mb-1">NodooTrace</div>
        <p class="text-mut text-sm mb-6">Inicia sesión para trazar tus productos.</p>

        <form (ngSubmit)="submit()" class="space-y-4">
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

          @if (notice()) {
            <div class="alert-success">{{ notice() }}</div>
          }
          @if (error()) {
            <div class="alert-error">{{ error() }}</div>
          }

          <button type="submit" [disabled]="busy()" class="btn-primary w-full">
            {{ busy() ? 'Iniciando sesión…' : 'Iniciar sesión' }}
          </button>
        </form>

        <p class="text-sm text-mut mt-6 text-center">
          ¿No tienes organización?
          <a routerLink="/register" class="link">Regístrate</a>
        </p>
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
    .alert-success,
    .alert-error {
      padding: 0.55rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }
    .alert-success {
      border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
      background: color-mix(in srgb, var(--color-success) 8%, transparent);
      color: var(--color-success);
    }
    .alert-error {
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
      color: var(--color-danger);
    }
    .link {
      color: var(--color-accent);
      text-decoration: none;
    }
    .link:hover {
      text-decoration: underline;
    }
  `,
})
export class Login implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/']);
      return;
    }
    if (this.route.snapshot.queryParamMap.get('registered') === '1') {
      const demo = this.route.snapshot.queryParamMap.get('demo') === '1';
      this.notice.set(
        demo
          ? 'Organización creada y activada. Inicia sesión para configurar qué operaciones hace tu empresa.'
          : 'Organización creada. Revisa tu correo para verificar la cuenta y luego inicia sesión.',
      );
    }
  }

  submit(): void {
    if (!this.email.trim() || !this.password) {
      this.error.set('Ingresa tu correo y contraseña.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);

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
