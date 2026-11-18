import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import {
  activityHint,
  activityLabel,
  operationGroupLabel,
  operationHint,
  operationLabel,
} from '../../core/labels';
import type {
  MeResponse,
  Operation,
  OperationSuggestion,
} from '../../core/models';

interface OperationGroup {
  group: string;
  label: string;
  items: Operation[];
}

@Component({
  selector: 'app-onboarding',
  imports: [FormsModule],
  template: `
    <div class="page">
      <header class="topbar">
        <div>
          <div class="brand">NodooTrace</div>
          <div class="brand-sub">Configuración de la organización</div>
        </div>
        <button type="button" class="btn-ghost" (click)="auth.logout()">
          Cerrar sesión
        </button>
      </header>

      <main class="content">
        <ol class="steps">
          <li class="done">
            <span class="num">1</span>
            <span>Cuenta creada</span>
          </li>
          <li class="active">
            <span class="num">2</span>
            <span>Operaciones y actividad</span>
          </li>
          <li>
            <span class="num">3</span>
            <span>Listo para trazar</span>
          </li>
        </ol>

        @if (loading()) {
          <p class="muted">Cargando operaciones…</p>
        } @else if (blocked()) {
          <section class="card">
            <h1 class="title">No puedes configurar esta organización</h1>
            <p class="muted mt-2">{{ blocked() }}</p>
            <button type="button" class="btn-primary mt-4" (click)="auth.logout()">
              Volver a iniciar sesión
            </button>
          </section>
        } @else {
          <section class="card">
            <div class="eyebrow">Paso 1</div>
            <h1 class="title">¿Qué hace tu empresa?</h1>
            <p class="muted mt-2">
              Marca todas las operaciones que realiza tu organización. No hace
              falta saber de clasificaciones: con esto te propondremos las
              actividades que mejor encajan.
            </p>

            <div class="groups">
              @for (group of groups(); track group.group) {
                <div class="group">
                  <div class="group-title">{{ group.label }}</div>
                  <div class="op-list">
                    @for (item of group.items; track item.code) {
                      <label class="op" [class.selected]="selected().has(item.code)">
                        <input
                          type="checkbox"
                          [checked]="selected().has(item.code)"
                          (change)="toggle(item.code)"
                        />
                        <span class="op-text">
                          <span class="op-label">{{ label(item.code) }}</span>
                          @if (hint(item.code)) {
                            <span class="op-hint">{{ hint(item.code) }}</span>
                          }
                        </span>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="actions">
              <span class="muted">
                {{ selected().size }} operación(es) seleccionada(s)
              </span>
              <button
                type="button"
                class="btn-primary"
                [disabled]="selected().size === 0 || suggestBusy()"
                (click)="suggest()"
              >
                {{ suggestBusy() ? 'Buscando…' : 'Ver actividades compatibles' }}
              </button>
            </div>
          </section>

          @if (error()) {
            <div class="alert-error">{{ error() }}</div>
          }

          @if (suggestions() !== null) {
            <section class="card">
              <div class="eyebrow">Paso 2</div>
              <h2 class="title">Elige una clasificación</h2>
              <p class="muted mt-2">
                Estas actividades cubren las operaciones que marcaste. Elige la
                que mejor describa a tu empresa; habilita también las
                operaciones extra que se indican.
              </p>

              @if (suggestions()!.length === 0) {
                <div class="notice">
                  Ninguna combinación de hasta 3 actividades cubre todas tus
                  operaciones. Crea una clasificación propia más abajo.
                </div>
              } @else {
                <div class="suggestions">
                  @for (
                    suggestion of suggestions();
                    track $index;
                    let first = $first
                  ) {
                    <div class="suggestion" [class.recommended]="first">
                      @if (first) {
                        <span class="tag">Recomendada</span>
                      }
                      <div class="activity-chips">
                        @for (activity of suggestion.activities; track activity.code) {
                          <span class="chip-activity">
                            {{ activityName(activity.code, activity.name) }}
                          </span>
                        }
                      </div>
                      <p class="muted mt-2">
                        Cubre tus {{ suggestion.covered.length }} operación(es).
                      </p>
                      @if (suggestion.extras.length > 0) {
                        <p class="hint mt-1">
                          También habilita:
                          {{ extraLabels(suggestion.extras) }}
                        </p>
                      }
                      <button
                        type="button"
                        class="btn-primary mt-3 w-full"
                        [disabled]="accepting() !== null"
                        (click)="accept(suggestion)"
                      >
                        {{ accepting() === suggestion.activities[0]?.code ? 'Guardando…' : 'Usar esta combinación' }}
                      </button>
                    </div>
                  }
                </div>
              }
            </section>

            <section class="card">
              <h2 class="title">O crea tu propia clasificación</h2>
              <p class="muted mt-2">
                Si ninguna te representa, ponle un nombre a la actividad de tu
                empresa. Se creará exactamente con las operaciones que marcaste.
              </p>

              <label class="block text-sm mt-4 mb-1" for="customName">
                Nombre de la actividad
              </label>
              <input
                id="customName"
                name="customName"
                [(ngModel)]="customName"
                class="field"
                maxlength="80"
                placeholder="Ej.: Distribuidor farmacéutico"
              />

              <div class="custom-ops">
                @for (code of selectedList(); track code) {
                  <span class="chip">{{ label(code) }}</span>
                }
              </div>

              <button
                type="button"
                class="btn-secondary mt-4"
                [disabled]="customBusy() || selected().size === 0"
                (click)="createCustom()"
              >
                {{ customBusy() ? 'Creando…' : 'Crear actividad propia' }}
              </button>
            </section>
          }

          <p class="hint">
            Esta configuración se realiza una sola vez. Si más adelante necesitas
            cambiarla, contacta al administrador de la plataforma.
          </p>
        }
      </main>
    </div>
  `,
  styles: `
    .page {
      min-height: 100vh;
      background: var(--color-bg);
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
    }
    .brand {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .brand-sub {
      font-size: 0.75rem;
      color: var(--color-mut);
    }
    .content {
      max-width: 56rem;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
      display: grid;
      gap: 1.25rem;
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 1px 2px rgb(16 24 40 / 0.04);
    }
    .eyebrow {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-accent);
      margin-bottom: 0.35rem;
    }
    .title {
      font-size: 1.15rem;
      font-weight: 650;
      letter-spacing: -0.01em;
    }
    .muted {
      color: var(--color-mut);
      font-size: 0.875rem;
    }
    .hint {
      color: var(--color-mut);
      font-size: 0.78rem;
    }
    .steps {
      display: flex;
      gap: 0.75rem;
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .steps li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      font-size: 0.78rem;
      color: var(--color-mut);
    }
    .steps .num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 9999px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      font-weight: 700;
      flex: none;
    }
    .steps li.done .num {
      background: var(--color-success);
      border-color: var(--color-success);
      color: #0b0f17;
    }
    .steps li.active .num {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-accent-ink);
      color: var(--color-accent-ink);
    }
    .steps li.active,
    .steps li.done {
      color: var(--color-ink);
    }
    .groups {
      display: grid;
      gap: 1.25rem;
      margin-top: 1.25rem;
    }
    .group-title {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-mut);
      margin-bottom: 0.5rem;
    }
    .op-list {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    }
    .op {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;
      padding: 0.6rem 0.7rem;
      border: 1px solid var(--color-border);
      border-radius: 0.55rem;
      background: var(--color-surface);
      cursor: pointer;
    }
    .op:hover {
      border-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
    }
    .op.selected {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface));
    }
    .op input {
      margin-top: 0.15rem;
      accent-color: var(--color-accent);
      flex: none;
    }
    .op-text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .op-label {
      font-size: 0.85rem;
      line-height: 1.25;
    }
    .op-hint {
      font-size: 0.72rem;
      color: var(--color-mut);
      line-height: 1.3;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 1.35rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
    }
    .suggestions {
      display: grid;
      gap: 0.85rem;
      margin-top: 1.1rem;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    }
    .suggestion {
      border: 1px solid var(--color-border);
      border-radius: 0.65rem;
      padding: 1rem;
      background: var(--color-surface);
      display: flex;
      flex-direction: column;
    }
    .suggestion.recommended {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent);
    }
    .tag {
      align-self: flex-start;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
      border-radius: 9999px;
      padding: 0.1rem 0.5rem;
      margin-bottom: 0.5rem;
    }
    .activity-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .chip-activity {
      display: inline-flex;
      padding: 0.2rem 0.55rem;
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--color-accent) 9%, var(--color-surface-2));
      border: 1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border));
      font-size: 0.78rem;
      font-weight: 600;
    }
    .notice {
      margin-top: 1rem;
      padding: 0.7rem 0.85rem;
      border-radius: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      background: color-mix(in srgb, var(--color-warning) 8%, transparent);
      color: var(--color-warning);
      font-size: 0.85rem;
    }
    .alert-error {
      padding: 0.7rem 0.85rem;
      border-radius: 0.5rem;
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
      color: var(--color-danger);
      font-size: 0.875rem;
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
    .custom-ops {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.75rem;
    }
    .chip {
      display: inline-flex;
      padding: 0.2rem 0.55rem;
      border-radius: 0.4rem;
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      font-size: 0.75rem;
      color: var(--color-ink);
    }
    .btn-primary,
    .btn-secondary,
    .btn-ghost {
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.55rem 0.9rem;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .btn-primary {
      background: var(--color-accent);
      color: var(--color-accent-ink);
    }
    .btn-primary:hover {
      background: color-mix(in srgb, var(--color-accent) 88%, #000);
    }
    .btn-secondary {
      background: var(--color-surface);
      color: var(--color-ink);
      border: 1px solid var(--color-border);
    }
    .btn-secondary:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
    .btn-ghost {
      background: transparent;
      color: var(--color-mut);
    }
    .btn-ghost:hover {
      color: var(--color-ink);
      background: var(--color-surface-2);
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .block {
      display: block;
    }
    .mt-1 {
      margin-top: 0.25rem;
    }
    .mt-2 {
      margin-top: 0.5rem;
    }
    .mt-3 {
      margin-top: 0.75rem;
    }
    .mt-4 {
      margin-top: 1rem;
    }
    .mb-1 {
      margin-bottom: 0.25rem;
    }
    .w-full {
      width: 100%;
    }
  `,
})
export class Onboarding implements OnInit {
  private readonly api = inject(Api);
  readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly blocked = signal<string | null>(null);
  readonly operations = signal<Operation[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly suggestions = signal<OperationSuggestion[] | null>(null);
  readonly suggestBusy = signal(false);
  readonly accepting = signal<string | null>(null);
  readonly customBusy = signal(false);
  readonly error = signal<string | null>(null);
  customName = '';

  readonly groups = computed<OperationGroup[]>(() => {
    const byGroup = new Map<string, Operation[]>();
    for (const operation of this.operations()) {
      const items = byGroup.get(operation.group) ?? [];
      items.push(operation);
      byGroup.set(operation.group, items);
    }
    return [...byGroup.entries()].map(([group, items]) => ({
      group,
      label: operationGroupLabel(group),
      items,
    }));
  });

  readonly selectedList = computed(() => [...this.selected()]);

  ngOnInit(): void {
    this.auth
      .me()
      .then((me) => this.prepare(me))
      .catch(() => {
        this.blocked.set('No pudimos cargar tu cuenta. Vuelve a iniciar sesión.');
        this.loading.set(false);
      });
  }

  private prepare(me: MeResponse): void {
    if (!me.actor) {
      this.blocked.set('Tu cuenta no está vinculada a una organización.');
      this.loading.set(false);
      return;
    }
    if ((me.actor.activities ?? []).length > 0) {
      void this.router.navigate(['/'], { replaceUrl: true });
      return;
    }
    if (!me.user.roles.includes('owner')) {
      this.blocked.set(
        'Solo el propietario de la organización puede completar esta configuración.',
      );
      this.loading.set(false);
      return;
    }

    this.api
      .listOperations()
      .then((operations) => this.operations.set(operations))
      .catch(() => this.error.set('No se pudieron cargar las operaciones.'))
      .finally(() => this.loading.set(false));
  }

  label(code: string): string {
    return operationLabel(code);
  }

  hint(code: string): string {
    return operationHint(code);
  }

  activityName(code: string, name: string): string {
    return activityLabel(code, name);
  }

  extraLabels(codes: string[]): string {
    return codes.map((code) => operationLabel(code)).join(', ');
  }

  toggle(code: string): void {
    const next = new Set(this.selected());
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    this.selected.set(next);
    this.suggestions.set(null);
    this.error.set(null);
  }

  suggest(): void {
    if (this.selected().size === 0) {
      return;
    }
    this.suggestBusy.set(true);
    this.error.set(null);

    this.api
      .suggestOperations([...this.selected()])
      .then((suggestions) => this.suggestions.set(suggestions))
      .catch((err: unknown) => this.error.set(this.messageFrom(err)))
      .finally(() => this.suggestBusy.set(false));
  }

  accept(suggestion: OperationSuggestion): void {
    const code = suggestion.activities[0]?.code ?? '';
    this.accepting.set(code);
    this.error.set(null);

    this.api
      .acceptActivities({
        activityCodes: suggestion.activities.map((activity) => activity.code),
        operations: [...this.selected()],
      })
      .then(() => this.finish())
      .catch((err: unknown) => this.error.set(this.messageFrom(err)))
      .finally(() => this.accepting.set(null));
  }

  createCustom(): void {
    const name = this.customName.trim();
    if (name.length < 2) {
      this.error.set('Escribe un nombre para tu actividad (mínimo 2 caracteres).');
      return;
    }
    if (this.selected().size === 0) {
      this.error.set('Selecciona al menos una operación.');
      return;
    }

    this.customBusy.set(true);
    this.error.set(null);

    this.api
      .createCustomActivity({ name, operations: [...this.selected()] })
      .then(() => this.finish())
      .catch((err: unknown) => this.error.set(this.messageFrom(err)))
      .finally(() => this.customBusy.set(false));
  }

  private finish(): void {
    void this.router.navigate(['/'], {
      queryParams: { onboarded: '1' },
      replaceUrl: true,
    });
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string'
      ? message
      : 'No se pudo guardar la configuración.';
  }
}
