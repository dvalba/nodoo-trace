import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api.service';
import {
  activityLabel,
  operationGroupLabel,
  operationHint,
  operationLabel,
} from '../../core/labels';
import type { Operation, OperationSuggestion } from '../../core/models';

interface OperationGroup {
  group: string;
  label: string;
  items: Operation[];
}

@Component({
  selector: 'app-operations-flow',
  imports: [FormsModule],
  template: `
    <section class="card">
      <h1 class="title">¿Qué hace tu empresa?</h1>
      <p class="muted mt-2">
        Marca todas las operaciones que realiza tu organización. No hace falta
        saber de clasificaciones: con esto te propondremos las actividades que
        mejor encajan.
      </p>

      @if (loading()) {
        <p class="muted mt-3">Cargando operaciones…</p>
      } @else {
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
      }
    </section>

    @if (error()) {
      <div class="alert-error">{{ error() }}</div>
    }

    @if (suggestions() !== null) {
      <section class="card">
        <h2 class="title">Elige una clasificación</h2>
        <p class="muted mt-2">
          Estas actividades cubren las operaciones que marcaste. Elige la que
          mejor describa a tu empresa; habilita también las operaciones extra
          que se indican.
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
                    También habilita: {{ extraLabels(suggestion.extras) }}
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

        <section class="card nested">
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
      </section>
    }
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.5rem;
    }
    .card.nested {
      margin-top: 1.25rem;
      padding: 1.25rem;
      border-style: dashed;
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
    .btn-secondary {
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
export class OperationsFlow implements OnInit {
  @Input() initialOperations: string[] = [];
  @Output() readonly saved = new EventEmitter<void>();

  private readonly api = inject(Api);

  readonly loading = signal(true);
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
    this.selected.set(new Set(this.initialOperations));
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
      .then(() => this.saved.emit())
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
      .then(() => this.saved.emit())
      .catch((err: unknown) => this.error.set(this.messageFrom(err)))
      .finally(() => this.customBusy.set(false));
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
