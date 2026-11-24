import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-xl">
        <div class="text-2xl font-semibold tracking-tight mb-1">NodooTrace</div>
        <p class="text-mut text-sm mb-6">
          Crea la cuenta de tu organización. En el siguiente paso configurarás
          qué operaciones hace tu empresa.
        </p>

        <ol class="steps mb-6">
          <li class="done">
            <span class="num">1</span>
            <span>Crea tu cuenta</span>
          </li>
          <li>
            <span class="num">2</span>
            <span>Configura tus operaciones</span>
          </li>
          <li>
            <span class="num">3</span>
            <span>Empieza a trazar</span>
          </li>
        </ol>

        <form (ngSubmit)="submit()" class="card space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-sm mb-1" for="legalName">Organización</label>
              <input
                id="legalName"
                name="legalName"
                [(ngModel)]="legalName"
                class="field"
                placeholder="Nombre de la organización"
              />
            </div>
            <div>
              <label class="block text-sm mb-1" for="organizationNumber">
                NIT / registro <span class="text-mut">(opcional)</span>
              </label>
              <input
                id="organizationNumber"
                name="organizationNumber"
                [(ngModel)]="organizationNumber"
                class="field"
                placeholder="901020301"
              />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-sm mb-1" for="adminFullName">
                Nombre del propietario
              </label>
              <input
                id="adminFullName"
                name="adminFullName"
                [(ngModel)]="adminFullName"
                class="field"
                placeholder="Dra. Elena Ríos"
              />
            </div>
            <div>
              <label class="block text-sm mb-1" for="adminEmail">Correo</label>
              <input
                id="adminEmail"
                name="adminEmail"
                [(ngModel)]="adminEmail"
                type="email"
                autocomplete="username"
                class="field"
                placeholder="owner@company.com"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm mb-1" for="adminPassword">Contraseña</label>
            <input
              id="adminPassword"
              name="adminPassword"
              [(ngModel)]="adminPassword"
              type="password"
              autocomplete="new-password"
              class="field"
              placeholder="Mín. 8 caracteres, una mayúscula y un número"
            />
            <p class="hint">
              Debe tener al menos 8 caracteres, una mayúscula, una minúscula y un
              número.
            </p>
          </div>

          @if (error()) {
            <div class="alert-error">{{ error() }}</div>
          }

          <button type="submit" [disabled]="busy()" class="btn-primary w-full">
            {{ busy() ? 'Creando organización…' : 'Crear organización' }}
          </button>

          <p class="hint text-center">
            No pedimos actividades aquí: las eliges después según lo que hace tu
            empresa.
          </p>
        </form>

        <p class="text-sm text-mut mt-6 text-center">
          ¿Ya tienes cuenta?
          <a routerLink="/login" class="link">Inicia sesión</a>
        </p>
      </div>
    </div>
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 1px 2px rgb(16 24 40 / 0.04);
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
      margin-top: 0.35rem;
    }
    .btn-primary {
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      background: var(--color-accent);
      color: var(--color-accent-ink);
      font-size: 0.875rem;
      font-weight: 600;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .alert-error {
      padding: 0.55rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
      color: var(--color-danger);
      font-size: 0.875rem;
    }
    .link {
      color: var(--color-accent);
      text-decoration: none;
    }
    .link:hover {
      text-decoration: underline;
    }
    .steps {
      display: flex;
      gap: 0.5rem;
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .steps li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      font-size: 0.75rem;
      color: var(--color-mut);
    }
    .steps .num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 9999px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      font-weight: 700;
      flex: none;
    }
    .steps li.done .num {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-accent-ink);
    }
    .steps li.done {
      color: var(--color-ink);
    }
  `,
})
export class Register implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  legalName = '';
  organizationNumber = '';
  adminFullName = '';
  adminEmail = '';
  adminPassword = '';

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/']);
    }
  }

  submit(): void {
    this.error.set(null);

    if (!this.legalName.trim() || !this.adminFullName.trim()) {
      this.error.set('Completa el nombre de la organización y del propietario.');
      return;
    }
    if (!this.adminEmail.trim() || !this.adminPassword) {
      this.error.set('Ingresa el correo y la contraseña del propietario.');
      return;
    }

    this.busy.set(true);

    this.auth
      .register({
        legalName: this.legalName.trim(),
        organizationNumber: this.organizationNumber.trim() || undefined,
        adminFullName: this.adminFullName.trim(),
        adminEmail: this.adminEmail.trim(),
        adminPassword: this.adminPassword,
      })
      .then((response) =>
        this.router.navigate(['/login'], {
          queryParams: { registered: '1' },
        }),
      )
      .catch((err: unknown) => this.error.set(this.messageFrom(err)))
      .finally(() => this.busy.set(false));
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string'
      ? message
      : 'No se pudo crear la organización.';
  }
}
