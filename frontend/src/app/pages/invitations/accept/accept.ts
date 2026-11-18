import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../../core/api.service';
import { userRoleLabel } from '../../../core/labels';
import type { InvitationPreview } from '../../../core/models';

type AcceptState =
  | 'loading'
  | 'form'
  | 'hasAccount'
  | 'orgBlocked'
  | 'done'
  | 'error';

@Component({
  selector: 'app-invitation-accept',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-md">
        <div class="text-2xl font-semibold tracking-tight mb-1">NodooTrace</div>
        <p class="text-mut text-sm mb-6">
          Invitación para unirte a una organización.
        </p>

        @if (state() === 'loading') {
          <div class="card">
            <p class="text-sm">Revisando tu invitación…</p>
          </div>
        }

        @if (state() === 'error') {
          <div class="card space-y-4">
            <div class="alert-error">{{ message() }}</div>
            <a routerLink="/login" class="btn-primary w-full text-center no-underline">
              Ir a iniciar sesión
            </a>
          </div>
        }

        @if (state() === 'hasAccount') {
          <div class="card space-y-4">
            <div class="alert-wait">
              Ya tienes una cuenta para
              <strong>{{ preview()?.actorName }}</strong>. Usa el enlace de
              verificación de tu correo para activar tu acceso.
            </div>
            <a routerLink="/invitations/verify/{{ token() }}" class="btn-primary w-full text-center no-underline">
              Verificar mi correo
            </a>
            <p class="text-sm text-mut text-center">
              ¿No lo tienes a mano?
              <a routerLink="/login" class="link">Inicia sesión</a>
            </p>
          </div>
        }

        @if (state() === 'orgBlocked') {
          <div class="card space-y-4">
            <div class="alert-wait">
              La organización
              <strong>{{ preview()?.actorName }}</strong> aún está en revisión.
              No puedes unirte todavía; vuelve a intentarlo más tarde.
            </div>
            <a routerLink="/login" class="btn-primary w-full text-center no-underline">
              Ir a iniciar sesión
            </a>
          </div>
        }

        @if (state() === 'done') {
          <div class="card space-y-4">
            <div class="alert-success">{{ message() }}</div>
            <p class="hint">
              Ya puedes iniciar sesión con {{ preview()?.email }} y tu
              contraseña.
            </p>
            <a routerLink="/login" class="btn-primary w-full text-center no-underline">
              Ir a iniciar sesión
            </a>
          </div>
        }

        @if (state() === 'form') {
          <div class="card space-y-4">
            <div class="space-y-1">
              <div class="text-sm font-semibold">
                Únete a {{ preview()?.actorName }}
              </div>
              <div class="text-xs text-mut">
                Invitado como {{ preview()?.email }}
              </div>
              <div class="role-row mt-2">
                @for (role of preview()?.roles ?? []; track role) {
                  <span class="role-chip">{{ userRoleLabel(role) }}</span>
                }
              </div>
            </div>

            <div>
              <label class="block text-sm mb-1" for="fullName">
                Nombre completo
              </label>
              <input
                id="fullName"
                name="fullName"
                [(ngModel)]="fullName"
                class="field"
                autocomplete="name"
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label class="block text-sm mb-1" for="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                [(ngModel)]="password"
                type="password"
                autocomplete="new-password"
                class="field"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            @if (formError()) {
              <div class="alert-error">{{ formError() }}</div>
            }

            <button
              type="button"
              (click)="submit()"
              [disabled]="busy()"
              class="btn-primary w-full"
            >
              {{ busy() ? 'Creando cuenta…' : 'Crear cuenta y unirme' }}
            </button>
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
    .alert-error,
    .alert-wait {
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
      border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      background: color-mix(in srgb, var(--color-warning) 8%, transparent);
      color: var(--color-warning);
    }
    .role-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .role-chip {
      display: inline-flex;
      padding: 0.15rem 0.55rem;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border));
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
export class InvitationAccept implements OnInit {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<AcceptState>('loading');
  readonly preview = signal<InvitationPreview | null>(null);
  readonly message = signal('');
  readonly busy = signal(false);
  readonly formError = signal<string | null>(null);

  fullName = '';
  password = '';

  readonly token = signal('');

  userRoleLabel(role: string): string {
    return userRoleLabel(role);
  }

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(token);
    if (!token) {
      this.state.set('error');
      this.message.set('Enlace de invitación inválido.');
      return;
    }

    this.api
      .previewInvitation(token)
      .then((preview) => {
        this.preview.set(preview);
        if (preview.hasAccount) {
          this.state.set('hasAccount');
        } else if (preview.actorStatus !== 'approved') {
          this.state.set('orgBlocked');
        } else {
          this.state.set('form');
        }
      })
      .catch((err: unknown) => {
        this.message.set(this.messageFrom(err));
        this.state.set('error');
      });
  }

  submit(): void {
    const name = this.fullName.trim();
    if (name.length < 2) {
      this.formError.set('Escribe tu nombre completo.');
      return;
    }
    if (this.password.length < 8) {
      this.formError.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    this.busy.set(true);
    this.formError.set(null);

    this.api
      .acceptInvitation({
        inviteToken: this.token(),
        fullName: name,
        password: this.password,
      })
      .then((result) => {
        this.message.set(result.message);
        this.state.set('done');
      })
      .catch((err: unknown) => this.formError.set(this.messageFrom(err)))
      .finally(() => this.busy.set(false));
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string'
      ? message
      : 'No se pudo procesar la invitación. Revisa que el enlace sea completo.';
  }
}
