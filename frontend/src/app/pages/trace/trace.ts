import {
  AfterViewChecked,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../../core/api.service';
import { Directory } from '../../core/directory.service';
import { DEMO_EPCS } from '../../core/demo';
import type {
  BizStep,
  BizTransactionType,
  Epc,
  EpcHistoryEntry,
  EpcStatus,
  EventEpcRole,
  EventType,
  Notice,
} from '../../core/models';

const STATUS_STYLES: Record<EpcStatus, string> = {
  active: '#5ec88a',
  in_transit: '#6aa9e8',
  in_progress: '#e0b458',
  consumed: '#8a97ad',
  damaged: '#f08a8a',
  expired: '#c98ad6',
};

const TYPE_LABELS: Record<EventType, string> = {
  ObjectEvent: 'Objeto',
  AggregationEvent: 'Agregación',
  TransactionEvent: 'Transacción',
  TransformationEvent: 'Transformación',
  AssociationEvent: 'Asociación',
};

const STATUS_LABELS: Record<EpcStatus, string> = {
  active: 'Activo',
  in_transit: 'En tránsito',
  in_progress: 'En proceso',
  consumed: 'Consumido',
  damaged: 'Dañado',
  expired: 'Vencido',
};

const ROLE_LABELS: Record<EventEpcRole, string> = {
  observed: 'Observado',
  parent: 'Contenedor',
  child: 'Contenido',
  input: 'Entrada',
  output: 'Salida',
  source: 'Origen',
  associated: 'Asociado',
};

const BIZ_STEP_LABELS: Record<BizStep, string> = {
  commissioning: 'Comisionamiento',
  receiving: 'Recepción',
  shipping: 'Envío',
  packing: 'Empaquetado',
  unpacking: 'Desempaquetado',
  transforming: 'Transformación',
  inspecting: 'Inspección',
};

const BIZ_TXN_TYPE_LABELS: Record<BizTransactionType, string> = {
  po: 'Orden de compra',
  inv: 'Factura',
  desadv: 'Desadujo',
  bol: 'Guía de remisión',
};

@Component({
  selector: 'app-trace',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Trazabilidad</h1>
        <p class="text-sm text-mut mt-1">
          Consulta un EPC para ver su gemelo digital, su historial completo y
          sus avisos vinculados.
        </p>
      </div>

      <div class="card">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-[240px]">
            <label class="block text-sm mb-1" for="epc">EPC URN</label>
            <input
              id="epc"
              [(ngModel)]="query"
              (keyup.enter)="lookup()"
              class="field font-mono text-xs"
              placeholder="urn:nodoo:epc:…"
            />
          </div>
          <button
            type="button"
            class="btn-primary"
            [disabled]="busy()"
            (click)="lookup()"
          >
            {{ busy() ? 'Consultando…' : 'Consultar' }}
          </button>
        </div>

        <div class="mt-4">
          <div class="text-xs uppercase tracking-wide text-mut mb-2">
            EPCs de ejemplo
          </div>
          <div class="flex flex-wrap gap-2">
            @for (epc of demoEpcs; track epc.urn) {
              <button
                type="button"
                class="chip"
                [disabled]="busy()"
                (click)="load(epc.urn)"
              >
                {{ epc.label }} · {{ epc.actor }}
              </button>
            }
          </div>
        </div>

        @if (error()) {
          <div class="mt-3 text-sm" style="color: #f08a8a">{{ error() }}</div>
        }
      </div>

      @let twin = epc();
      @if (twin) {
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-1 space-y-6">
            <section class="card">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm font-semibold">Gemelo digital</h2>
                <span
                  class="badge"
                   [style.background]="statusColor(twin.status)"
                  [style.color]="'#0b0f17'"
                >
                   {{ statusLabel(twin.status) }}
                </span>
              </div>

              <dl class="space-y-3 text-sm">
                <div>
                    <dt class="text-mut text-xs">Producto</dt>
                  <dd class="mt-0.5">
                    {{ twin.product?.name ?? '—' }}
                    @if (twin.product) {
                      <span class="text-mut"> · {{ twin.product.sku }}</span>
                    }
                  </dd>
                </div>
                <div>
                    <dt class="text-mut text-xs">Lote</dt>
                  <dd class="mt-0.5">{{ twin.batch?.batchCode ?? '—' }}</dd>
                </div>
                <div>
                    <dt class="text-mut text-xs">Productor</dt>
                  <dd class="mt-0.5">{{ actorName(twin.producerActorId) }}</dd>
                </div>
                <div>
                    <dt class="text-mut text-xs">Propietario</dt>
                  <dd class="mt-0.5">{{ actorName(twin.ownerActorId) }}</dd>
                </div>
                <div>
                    <dt class="text-mut text-xs">Custodio</dt>
                  <dd class="mt-0.5">{{ actorName(twin.custodianActorId) }}</dd>
                </div>
                <div>
                    <dt class="text-mut text-xs">Comisionado</dt>
                  <dd class="mt-0.5">{{ date(twin.commissionedAt) }}</dd>
                </div>
              </dl>

              <div class="mt-4 pt-3 border-t border-border">
                <div class="text-xs text-mut break-all font-mono">
                  {{ twin.id }}
                </div>
              </div>
            </section>

            <section class="card">
              <h2 class="text-sm font-semibold mb-3">Avisos vinculados</h2>
              @if (notices().length === 0) {
                <p class="text-sm text-mut">No hay avisos para este producto.</p>
              } @else {
                <div class="space-y-2">
                  @for (notice of notices(); track notice.id) {
                    <button
                      type="button"
                      class="notice-link"
                      (click)="goToNotice(notice.id)"
                    >
                      <span class="text-sm">{{ notice.title }}</span>
                      <span class="text-xs text-mut">
                        {{ notice.type }}
                      </span>
                    </button>
                  }
                </div>
              }
            </section>
          </div>

          <div class="lg:col-span-2">
            <section class="card">
              <h2 class="text-sm font-semibold mb-4">
                Historial · {{ history().length }} evento(s)
              </h2>
              @if (history().length === 0) {
                <p class="text-sm text-mut">No hay eventos registrados para este EPC.</p>
              } @else {
                <ol class="timeline">
                  @for (entry of history(); track entry.id) {
                    <li class="timeline-item">
                      <div class="timeline-marker"></div>
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span class="text-sm font-medium">
                          {{ entryLabel(entry) }}
                        </span>
                        <span class="text-xs text-mut">{{ actorName(entry.actorId) }}</span>
                      </div>
                      <div class="text-xs text-mut mt-1">
                        {{ date(entry.eventTime) }}
                        @if (entry.bizTransactionId) {
                          <span> · {{ txnTypeLabel(entry.bizTransactionType) }}: {{ entry.bizTransactionId }}</span>
                        }
                      </div>
                      @if (entry.disposition) {
                        <div class="text-xs mt-1">
                          Disposición:
                          <span
                            class="badge"
                            [style.background]="statusColor(entry.disposition)"
                            [style.color]="'#0b0f17'"
                          >
                            {{ statusLabel(entry.disposition) }}
                          </span>
                        </div>
                      }
                    </li>
                  }
                </ol>
              }
            </section>
          </div>
        </div>
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
      background: var(--color-bg);
      color: var(--color-ink);
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
    .chip {
      padding: 0.35rem 0.7rem;
      border-radius: 9999px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
      font-size: 0.75rem;
      transition: border-color 0.15s ease;
    }
    .chip:hover {
      border-color: var(--color-accent);
    }
    .chip:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .notice-link {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
    }
    .notice-link:hover {
      border-color: var(--color-accent);
    }
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0 0 0 1.25rem;
      position: relative;
      border-left: 1px solid var(--color-border);
    }
    .timeline-item {
      position: relative;
      padding: 0 0 1.25rem 0.75rem;
    }
    .timeline-item:last-child {
      padding-bottom: 0;
    }
    .timeline-marker {
      position: absolute;
      left: -1.55rem;
      top: 0.25rem;
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 9999px;
      background: var(--color-accent);
      border: 2px solid var(--color-surface);
    }
  `,
})
export class Trace implements OnInit, AfterViewChecked {
  private readonly api = inject(Api);
  private readonly directory = inject(Directory);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  query = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly epc = signal<Epc | null>(null);
  readonly history = signal<EpcHistoryEntry[]>([]);
  readonly notices = signal<Notice[]>([]);
  readonly demoEpcs = DEMO_EPCS;

  private readonly resolvedActors = new Set<string>();

  ngOnInit(): void {
    const epc = this.route.snapshot.queryParamMap.get('epc');
    if (epc) {
      this.query = epc;
      this.load(epc);
    }
  }

  ngAfterViewChecked(): void {
    // Ensure actor names resolve for the current twin + history.
    const epc = this.epc();
    const ids = new Set<string>();
    if (epc) {
      for (const id of [
        epc.producerActorId,
        epc.ownerActorId,
        epc.custodianActorId,
      ]) {
        if (id) ids.add(id);
      }
    }
    for (const entry of this.history()) {
      ids.add(entry.actorId);
    }
    ids.forEach((id) => {
      if (!this.resolvedActors.has(id)) {
        this.resolvedActors.add(id);
        void this.directory.get(id);
      }
    });
  }

  lookup(): void {
    const q = this.query.trim();
    if (!q) {
      this.error.set('Ingresa un URN de EPC.');
      return;
    }
    this.load(q);
  }

  load(urn: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.epc.set(null);
    this.history.set([]);
    this.notices.set([]);

    Promise.all([this.api.getEpc(urn), this.api.getHistory(urn)])
      .then(([epc, history]) => {
        this.epc.set(epc);
        this.history.set(history);
        if (epc.productId) {
          this.api
            .listNotices(epc.productId)
            .then((notices) => this.notices.set(notices))
            .catch(() => this.notices.set([]));
        }
      })
      .catch((err: unknown) => {
        const payload = (err as { error?: { message?: unknown } })?.error;
        this.error.set(
          typeof payload?.message === 'string'
            ? payload.message
            : 'EPC no encontrado o no tienes acceso a él.',
        );
      })
      .finally(() => this.busy.set(false));
  }

  actorName(id: string | null): string {
    return this.directory.name(id);
  }

  statusColor(status: EpcStatus): string {
    return STATUS_STYLES[status] ?? '#8a97ad';
  }

  statusLabel(status: EpcStatus): string {
    return STATUS_LABELS[status] ?? status.replace('_', ' ');
  }

  typeLabel(type: EventType): string {
    return TYPE_LABELS[type] ?? type;
  }

  txnTypeLabel(type: BizTransactionType | null): string {
    return type ? (BIZ_TXN_TYPE_LABELS[type] ?? type) : '';
  }

  entryLabel(entry: EpcHistoryEntry): string {
    const parts = [
      this.typeLabel(entry.type),
      ROLE_LABELS[entry.role] ?? entry.role,
    ];
    if (entry.bizStep) {
      parts.push(BIZ_STEP_LABELS[entry.bizStep] ?? entry.bizStep);
    }
    return parts.join(' · ');
  }

  date(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  goToNotice(noticeId: string): void {
    void this.router.navigate(['/notices'], {
      queryParams: { notice: noticeId },
    });
  }
}
