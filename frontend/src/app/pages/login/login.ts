import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../core/auth.service';
import { Api } from '../../core/api.service';

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
          @if (error() && emailCode() === null) {
            <div class="alert-error">{{ error() }}</div>
          }

          @if (emailCode() === 'EMAIL_UNVERIFIED') {
            <div class="space-y-3">
              <p class="text-sm">
                Tu cuenta no está verificada. Revisa tu correo o reenvía el
                enlace de verificación.
              </p>
              @if (resendNotice()) {
                <div class="alert-success">{{ resendNotice() }}</div>
              }
              @if (resendError()) {
                <div class="alert-error">{{ resendError() }}</div>
              }
              <button
                type="button"
                (click)="resendVerification()"
                [disabled]="resendBusy()"
                class="btn-primary w-full"
              >
                {{
                  resendBusy()
                    ? 'Reenviando…'
                    : 'Reenviar correo de verificación'
                }}
              </button>
            </div>
          }

          @if (emailCode() === 'AWAITING_APPROVAL') {
            <div class="alert-wait">
              @if (actorName()) {
                <p class="text-sm">
                  La organización <strong>{{ actorName() }}</strong> está
                  pendiente de aprobación.
                </p>
              } @else {
                <p class="text-sm">
                  Tu organización está pendiente de aprobación.
                </p>
              }
              <p class="hint">
                Te avisaremos cuando esté activa y puedas iniciar sesión.
              </p>
            </div>
          }

          @if (emailCode() !== 'AWAITING_APPROVAL') {
            <button type="submit" [disabled]="busy()" class="btn-primary w-full">
              {{ busy() ? 'Iniciando sesión…' : 'Iniciar sesión' }}
            </button>
          }
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
    .alert-wait {
      padding: 0.75rem 0.9rem;
      border-radius: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      background: color-mix(in srgb, var(--color-warning) 8%, transparent);
      color: var(--color-ink);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
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
  private readonly api = inject(Api);

  email = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly emailCode = signal<string | null>(null);
  readonly actorName = signal<string | null>(null);
  readonly resendBusy = signal(false);
  readonly resendNotice = signal<string | null>(null);
  readonly resendError = signal<string | null>(null);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/']);
      return;
    }
    if (this.route.snapshot.queryParamMap.get('registered') === '1') {
      this.notice.set(
        'Organización creada. Revisa tu correo para verificar la cuenta y luego inicia sesión.',
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
    this.emailCode.set(null);
    this.actorName.set(null);
    this.resendNotice.set(null);
    this.resendError.set(null);

    this.auth
      .login(this.email.trim(), this.password)
      .then(() => void this.router.navigate(['/']))
      .catch((err: unknown) => {
        const payload = (
          err as { error?: { code?: unknown; message?: unknown; actorName?: unknown } }
        )?.error;
        const code = typeof payload?.code === 'string' ? payload.code : null;
        const message =
          typeof payload?.message === 'string'
            ? payload.message
            : 'Credenciales inválidas.';
        const actorName =
          typeof payload?.actorName === 'string' ? payload.actorName : null;

        if (code === 'EMAIL_UNVERIFIED') {
          this.emailCode.set(code);
          this.actorName.set(actorName);
          return;
        }
        if (code === 'AWAITING_APPROVAL') {
          this.emailCode.set(code);
          this.actorName.set(actorName);
          return;
        }
        this.error.set(message);
      })
      .finally(() => this.busy.set(false));
  }

  resendVerification(): void {
    const email = this.email.trim();
    if (!email) {
      this.resendError.set('Ingresa tu correo para reenviar el enlace.');
      return;
    }
    this.resendBusy.set(true);
    this.resendNotice.set(null);
    this.resendError.set(null);

    this.api
      .resendVerification(email)
      .then(() =>
        this.resendNotice.set(
          'Correo de verificación reenviado. Revisa tu bandeja de entrada.',
        ),
      )
      .catch((err: unknown) => {
        const payload = (
          err as { error?: { message?: unknown } }
        )?.error;
        const message =
          typeof payload?.message === 'string'
            ? payload.message
            : Array.isArray(payload?.message)
              ? (payload?.message as string[]).join(' ')
              : 'No se pudo reenviar el correo de verificación.';
        this.resendError.set(message);
      })
      .finally(() => this.resendBusy.set(false));
  }
}
