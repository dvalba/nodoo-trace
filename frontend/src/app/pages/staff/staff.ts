import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import type { PendingActor } from '../../core/models';

@Component({
  selector: 'app-staff',
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Aprobaciones</h1>
        <p class="text-sm text-mut mt-1">
          Organizaciones que esperan aprobación. Al aprobar una, se activan
          también sus usuarios pendientes.
        </p>
      </div>

      @if (loading()) {
        <p class="text-sm text-mut">Cargando organizaciones…</p>
      } @else if (error()) {
        <div class="alert-error">{{ error() }}</div>
      } @else if (pending().length === 0) {
        <div class="card">
          <h2 class="text-sm font-semibold">Sin pendientes</h2>
          <p class="text-sm text-mut mt-1">
            No hay organizaciones esperando aprobación.
          </p>
        </div>
      } @else {
        <section class="card">
          <h2 class="text-sm font-semibold mb-3">
            Pendientes · {{ pending().length }}
          </h2>
          <div class="divide-y divide-border">
            @for (actor of pending(); track actor.id) {
              <div class="actor-row">
                <div class="actor-id">
                  <div class="text-sm font-medium">{{ actor.name }}</div>
                  @if (actor.organizationNumber) {
                    <div class="text-xs text-mut">
                      RIF {{ actor.organizationNumber }}
                    </div>
                  }
                </div>
                <div class="actor-actions">
                  @if (approvedIds().has(actor.id)) {
                    <span class="approved-chip">Aprobada</span>
                  } @else {
                    <button
                      type="button"
                      class="btn-primary"
                      [disabled]="approving() === actor.id"
                      (click)="approve(actor)"
                    >
                      {{ approving() === actor.id ? 'Aprobando…' : 'Aprobar' }}
                    </button>
                  }
                </div>
              </div>
            }
          </div>
          @if (notice()) {
            <div class="alert-success mt-3">{{ notice() }}</div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    .actor-row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0;
    }
    .actor-row:first-child {
      padding-top: 0;
    }
    .actor-row:last-child {
      padding-bottom: 0;
    }
    .actor-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      justify-content: flex-end;
    }
    .btn-primary {
      padding: 0.5rem 1rem;
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
    .approved-chip {
      display: inline-flex;
      padding: 0.2rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-success);
      background: color-mix(in srgb, var(--color-success) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-success) 25%, transparent);
    }
    .alert-error,
    .alert-success {
      padding: 0.55rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }
    .alert-error {
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
      color: var(--color-danger);
    }
    .alert-success {
      border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
      background: color-mix(in srgb, var(--color-success) 8%, transparent);
      color: var(--color-success);
    }
  `,
})
export class Staff implements OnInit {
  private readonly api = inject(Api);
  readonly auth = inject(Auth);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pending = signal<PendingActor[]>([]);
  readonly approving = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly approvedIds = signal<Set<string>>(new Set());

  readonly isStaff = computed(
    () => this.auth.me()?.user.platformRoles.includes('staff') ?? false,
  );

  ngOnInit(): void {
    this.auth
      .refreshMe()
      .then(() => this.load())
      .catch(() => null);
  }

  private load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    return this.api
      .listPendingActors()
      .then((list) => this.pending.set(list))
      .catch((err: unknown) => this.error.set(this.messageFrom(err)))
      .finally(() => this.loading.set(false));
  }

  approve(actor: PendingActor): void {
    this.approving.set(actor.id);
    this.notice.set(null);
    this.api
      .approveActor(actor.id)
      .then((result) => {
        this.pending.update((list) =>
          list.filter((item) => item.id !== actor.id),
        );
        this.approvedIds.update((set) => new Set(set).add(actor.id));
        const users = result.activatedUsers;
        this.notice.set(
          users > 0
            ? `Aprobada ${actor.name}. Se activaron ${users} usuario(s).`
            : `Aprobada ${actor.name}.`,
        );
      })
      .catch((err: unknown) => this.error.set(this.messageFrom(err)))
      .finally(() => this.approving.set(null));
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string'
      ? message
      : 'No se pudieron cargar las organizaciones.';
  }
}
