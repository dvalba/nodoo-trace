import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import type { ActivityType } from '../../core/models';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-lg">
        <div class="text-2xl font-semibold tracking-tight mb-1">NodooTrace</div>
        <p class="text-mut text-sm mb-6">
          Registra tu organización y crea la cuenta del propietario.
        </p>

        <form (ngSubmit)="submit()" class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-sm mb-1" for="legalName">Organización</label>
              <input
                id="legalName"
                name="legalName"
                [(ngModel)]="legalName"
                class="field"
                placeholder="Laboratorios FarmaSur"
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

          <div>
            <div class="text-sm mb-2">¿Qué hace tu organización?</div>
            @if (loadingActivities()) {
              <p class="text-sm text-mut">Cargando actividades…</p>
            } @else {
              <div class="grid gap-2 sm:grid-cols-2">
                @for (activity of activities(); track activity.code) {
                  <label class="activity">
                    <input
                      type="checkbox"
                      [checked]="selected().has(activity.code)"
                      (change)="toggle(activity.code)"
                    />
                    <span>
                      <span class="block text-sm">{{ activity.name }}</span>
                      <span class="block text-xs text-mut">
                        {{ activity.description }}
                      </span>
                    </span>
                  </label>
                }
              </div>
            }
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
              placeholder="Mín. 8, una mayúscula, una minúscula y un número"
            />
          </div>

          @if (error()) {
            <div class="text-sm" style="color: #f08a8a">{{ error() }}</div>
          }

          <button type="submit" [disabled]="busy()" class="btn-primary w-full">
            {{ busy() ? 'Creando organización…' : 'Crear organización' }}
          </button>
        </form>

        <p class="text-sm text-mut mt-6 text-center">
          ¿Ya tienes cuenta?
          <a routerLink="/login" class="link">Inicia sesión</a>
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
      padding: 0.55rem 0.75rem;
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
    .activity {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;
      padding: 0.55rem 0.7rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      cursor: pointer;
    }
    .activity:hover {
      border-color: var(--color-accent);
    }
    .activity input {
      margin-top: 0.15rem;
      accent-color: var(--color-accent);
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
export class Register implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  legalName = '';
  organizationNumber = '';
  adminFullName = '';
  adminEmail = '';
  adminPassword = '';

  readonly activities = signal<ActivityType[]>([]);
  readonly loadingActivities = signal(true);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/']);
      return;
    }

    this.api
      .listActivityTypes()
      .then((activities) => this.activities.set(activities))
      .catch(() => this.error.set('No se pudieron cargar las actividades.'))
      .finally(() => this.loadingActivities.set(false));
  }

  toggle(code: string): void {
    const next = new Set(this.selected());
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    this.selected.set(next);
  }

  submit(): void {
    this.error.set(null);

    if (!this.legalName.trim() || !this.adminFullName.trim()) {
      this.error.set('Completa el nombre de la organización y del propietario.');
      return;
    }
    if (this.selected().size === 0) {
      this.error.set('Selecciona al menos una actividad.');
      return;
    }
    if (!this.adminEmail.trim()) {
      this.error.set('Ingresa el correo del propietario.');
      return;
    }
    if (
      this.adminPassword.length < 8 ||
      !/[a-z]/.test(this.adminPassword) ||
      !/[A-Z]/.test(this.adminPassword) ||
      !/\d/.test(this.adminPassword)
    ) {
      this.error.set(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
      );
      return;
    }

    this.busy.set(true);
    const email = this.adminEmail.trim();

    this.auth
      .register({
        legalName: this.legalName.trim(),
        organizationNumber: this.organizationNumber.trim() || undefined,
        activityCodes: [...this.selected()],
        adminFullName: this.adminFullName.trim(),
        adminEmail: email,
        adminPassword: this.adminPassword,
      })
      .then((result) => {
        if (result.demoMode) {
          return this.auth
            .login(email, this.adminPassword)
            .then(() => void this.router.navigate(['/']));
        }
        return this.router.navigate(['/login'], {
          queryParams: { registered: '1' },
        });
      })
      .catch((err: unknown) => {
        this.error.set(this.messageFrom(err));
      })
      .finally(() => this.busy.set(false));
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    if (typeof message === 'string') {
      return message;
    }
    return 'No se pudo registrar la organización.';
  }
}
