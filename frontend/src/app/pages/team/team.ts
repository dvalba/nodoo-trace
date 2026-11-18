import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { userRoleLabel } from '../../core/labels';
import type { Member, MeResponse, UserRole } from '../../core/models';

const ASSIGNABLE_ROLES: UserRole[] = ['member', 'viewer', 'admin'];

@Component({
  selector: 'app-team',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Equipo</h1>
        <p class="text-sm text-mut mt-1">
          Administra quién tiene acceso a {{ me()?.actor?.name ?? 'tu organización' }}.
          Invita por correo y cambia sus permisos.
        </p>
      </div>

      @if (loading()) {
        <p class="text-sm text-mut">Cargando equipo…</p>
      } @else if (!canManage()) {
        <div class="card">
          <h2 class="text-sm font-semibold">Solo administración</h2>
          <p class="text-sm text-mut mt-1">
            Solo el propietario o un administrador de la organización puede
            gestionar el equipo.
          </p>
        </div>
      } @else {
        <section class="card">
          <h2 class="text-sm font-semibold mb-3">Invitar a alguien</h2>
          <p class="text-xs text-mut mb-3">
            Si el correo ya tiene una invitación pendiente, se reenvía el correo.
          </p>
          <div class="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
            <div>
              <label class="block text-sm mb-1" for="inviteEmail">
                Correo
              </label>
              <input
                id="inviteEmail"
                [(ngModel)]="inviteEmail"
                name="inviteEmail"
                type="email"
                class="field"
                placeholder="person@company.com"
              />
            </div>
            <div class="md:flex md:gap-2 md:w-auto">
              <label class="block text-sm mb-1" for="inviteRole">Rol</label>
              <select
                id="inviteRole"
                [(ngModel)]="inviteRole"
                name="inviteRole"
                class="field md:w-44"
              >
                @for (role of assignableRoles(); track role) {
                  <option [value]="role">{{ userRoleLabel(role) }}</option>
                }
              </select>
            </div>
            <button
              type="button"
              class="btn-primary"
              [disabled]="inviteBusy()"
              (click)="invite()"
            >
              {{ inviteBusy() ? 'Enviando…' : 'Invitar' }}
            </button>
          </div>
          @if (inviteNotice()) {
            <div class="alert-success mt-3">{{ inviteNotice() }}</div>
          }
          @if (inviteError()) {
            <div class="alert-error mt-3">{{ inviteError() }}</div>
          }
        </section>

        <section class="card">
          <h2 class="text-sm font-semibold mb-3">Miembros · {{ members().length }}</h2>
          @if (members().length === 0) {
            <p class="text-sm text-mut">Aún no hay otros miembros.</p>
          } @else {
            <div class="divide-y divide-border">
              @for (member of members(); track member.id) {
                <div class="member-row" [class.is-self]="member.id === me()?.user?.id">
                  <div class="member-id">
                    <div class="text-sm font-medium">{{ member.fullName }}</div>
                    <div class="text-xs text-mut">{{ member.email }}</div>
                  </div>

                  <div class="member-roles">
                    @for (role of member.roles; track role) {
                      <span class="role-chip">{{ userRoleLabel(role) }}</span>
                    }
                  </div>

                  @if (member.roles.includes('owner')) {
                    <div class="member-actions">
                      <span class="text-xs text-mut">Propietario</span>
                    </div>
                  } @else if (member.id !== me()?.user?.id) {
                    <div class="member-actions">
                      <label class="role-toggle">
                        <input
                          type="checkbox"
                          [checked]="member.roles.includes('admin')"
                          (change)="toggleRole(member, 'admin')"
                        />
                        Admin
                      </label>
                      <button
                        type="button"
                        class="btn-danger"
                        [disabled]="removing() === member.id"
                        (click)="remove(member)"
                      >
                        {{ removing() === member.id ? '…' : 'Quitar' }}
                      </button>
                    </div>
                  } @else {
                    <div class="member-actions">
                      <span class="text-xs text-mut">Tú</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
          @if (listError()) {
            <div class="alert-error mt-3">{{ listError() }}</div>
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
    .btn-danger {
      padding: 0.35rem 0.7rem;
      border-radius: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
      background: transparent;
      color: var(--color-danger);
      font-size: 0.78rem;
      font-weight: 600;
    }
    .btn-danger:hover {
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    }
    .btn-danger:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .member-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0;
    }
    .member-row:first-child {
      padding-top: 0;
    }
    .member-row:last-child {
      padding-bottom: 0;
    }
    .member-row.is-self {
      opacity: 0.8;
    }
    .member-roles {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      justify-content: flex-end;
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
    .member-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      min-width: 9rem;
      justify-content: flex-end;
    }
    .role-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      color: var(--color-mut);
      cursor: pointer;
    }
    .role-toggle input {
      accent-color: var(--color-accent);
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
  `,
})
export class Team implements OnInit {
  private readonly api = inject(Api);
  readonly auth = inject(Auth);

  readonly loading = signal(true);
  readonly meState = signal<MeResponse | null>(null);
  readonly me = this.meState.asReadonly();
  readonly members = signal<Member[]>([]);
  readonly listError = signal<string | null>(null);

  readonly inviteEmail = signal('');
  readonly inviteRole = signal<UserRole>('member');
  readonly inviteBusy = signal(false);
  readonly inviteNotice = signal<string | null>(null);
  readonly inviteError = signal<string | null>(null);
  readonly removing = signal<string | null>(null);

  readonly assignableRoles = signal<UserRole[]>(ASSIGNABLE_ROLES);

  readonly canManage = computed(() => {
    const roles = this.meState()?.user.roles ?? [];
    return roles.includes('owner') || roles.includes('admin');
  });

  ngOnInit(): void {
    this.auth
      .refreshMe()
      .then((me) => {
        this.meState.set(me);
        return this.api.listMembers();
      })
      .then((members) => this.members.set(members))
      .catch((err: unknown) => this.listError.set(this.messageFrom(err)))
      .finally(() => this.loading.set(false));
  }

  userRoleLabel(role: UserRole): string {
    return userRoleLabel(role);
  }

  invite(): void {
    const email = this.inviteEmail().trim();
    if (!email) {
      this.inviteError.set('Ingresa el correo a invitar.');
      return;
    }
    this.inviteBusy.set(true);
    this.inviteNotice.set(null);
    this.inviteError.set(null);

    this.api
      .inviteMember({ email, roles: [this.inviteRole()] })
      .then((inv) => {
        this.inviteNotice.set(
          `Invitación enviada a ${inv.email}. Revisa su bandeja de entrada.`,
        );
        this.inviteEmail.set('');
      })
      .catch((err: unknown) => {
        this.inviteError.set(this.messageFrom(err));
      })
      .finally(() => this.inviteBusy.set(false));
  }

  toggleRole(member: Member, role: UserRole): void {
    if (member.roles.includes(role)) {
      return;
    }
    this.api
      .addMemberRoles(member.id, [role])
      .then((updated) =>
        this.members.update((list) =>
          list.map((m) => (m.id === updated.id ? updated : m)),
        ),
      )
      .catch((err: unknown) => this.listError.set(this.messageFrom(err)));
  }

  remove(member: Member): void {
    if (!window.confirm(`¿Quitar a ${member.fullName} del equipo?`)) {
      return;
    }
    this.removing.set(member.id);
    this.api
      .removeMember(member.id)
      .then(() =>
        this.members.update((list) =>
          list.filter((m) => m.id !== member.id),
        ),
      )
      .catch((err: unknown) => this.listError.set(this.messageFrom(err)))
      .finally(() => this.removing.set(null));
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string' ? message : 'Ocurrió un error.';
  }
}
