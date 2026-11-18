import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../../core/api.service';

type VerifyState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-invitation-verify',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-md">
        <div class="text-2xl font-semibold tracking-tight mb-1">NodooTrace</div>
        <p class="text-mut text-sm mb-6">
          Verificación del correo para activar tu cuenta.
        </p>

        @if (state() === 'loading') {
          <div class="card">
            <p class="text-sm">Verificando tu correo…</p>
          </div>
        }

        @if (state() === 'success') {
          <div class="card space-y-4">
            <div class="alert-success">{{ message() }}</div>
            <p class="hint">
              Ya puedes iniciar sesión con tu correo y contraseña.
            </p>
            <a routerLink="/login" class="btn-primary w-full text-center no-underline">
              Ir a iniciar sesión
            </a>
          </div>
        }

        @if (state() === 'error') {
          <div class="card space-y-4">
            <div class="alert-error">{{ message() }}</div>

            <div>
              <label class="block text-sm mb-1" for="resendEmail">
                Correo registrado
              </label>
              <input
                id="resendEmail"
                name="resendEmail"
                [(ngModel)]="resendEmail"
                type="email"
                autocomplete="username"
                class="field"
                placeholder="you@company.com"
              />
            </div>

            @if (resendNotice()) {
              <div class="alert-success">{{ resendNotice() }}</div>
            }
            @if (resendError()) {
              <div class="alert-error">{{ resendError() }}</div>
            }

            <button
              type="button"
              (click)="resend()"
              [disabled]="resendBusy()"
              class="btn-primary w-full"
            >
              {{ resendBusy() ? 'Reenviando…' : 'Reenviar correo de verificación' }}
            </button>

            <p class="text-sm text-mut text-center">
              ¿No necesitas reenviar?
              <a routerLink="/login" class="link">Inicia sesión</a>
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    .field {
      width: 100%;
      padding: 0.55rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-ink);
      font-size: 0.875rem;
    }
    .field:focus {
      outline: 2px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
      border-color: var(--color-accent);
    }
    .hint {
      font-size: 0.75rem;
      color: var(--color-mut);
    }
    .btn-primary {
      display: block;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      background: var(--color-accent);
      color: var(--color-accent-ink);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
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
export class InvitationVerify implements OnInit {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<VerifyState>('loading');
  readonly message = signal('');
  readonly resendEmail = signal('');
  readonly resendBusy = signal(false);
  readonly resendNotice = signal<string | null>(null);
  readonly resendError = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!token) {
      this.state.set('error');
      this.message.set('Enlace de verificación inválido.');
      return;
    }

    this.api
      .verifyEmailToken(token)
      .then((result) => {
        this.message.set(result.message);
        this.resendEmail.set(result.email);
        this.state.set('success');
      })
      .catch((err: unknown) => {
        this.message.set(this.messageFrom(err));
        this.state.set('error');
      });
  }

  resend(): void {
    const email = this.resendEmail().trim();
    if (!email) {
      this.resendError.set('Ingresa el correo registrado.');
      return;
    }
    this.resendBusy.set(true);
    this.resendNotice.set(null);
    this.resendError.set(null);

    this.api
      .resendVerification(email)
      .then(() => {
        this.resendNotice.set(
          'Correo de verificación reenviado. Revisa tu bandeja de entrada.',
        );
      })
      .catch((err: unknown) => this.resendError.set(this.messageFrom(err)))
      .finally(() => this.resendBusy.set(false));
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string'
      ? message
      : 'No se pudo verificar el enlace. Revisa que el enlace sea completo.';
  }
}
