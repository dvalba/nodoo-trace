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
import { Auth } from '../../core/auth.service';
import { Directory } from '../../core/directory.service';
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
  desadv: 'Aviso de despacho',
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
          Consulta un caso por su EPC para ver su gemelo digital, el historial
          completo y sus avisos vinculados.
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

        @if (error()) {
          <div class="mt-3 text-sm" style="color: #f08a8a">{{ error() }}</div>
        }
      </div>

      <section class="card">
        <h2 class="text-sm font-semibold mb-3">
          Mis casos · {{ myCases().length }}
        </h2>
        @if (myCases().length === 0) {
          <p class="text-sm text-mut">
            Aún no tienes casos. Genera casos desde la página de Productos.
          </p>
        } @else {
          <div class="grid gap-2 md:grid-cols-2">
            @for (item of myCases(); track item.id) {
              <button type="button" class="case-row" (click)="load(item.id)">
                <span class="flex items-center gap-2">
                  <span class="badge" [style.background]="statusColor(item.status)" [style.color]="'#0b0f17'">
                    {{ statusLabel(item.status) }}
                  </span>
                  <span class="font-mono text-xs">{{ short(item.id) }}</span>
                </span>
                <span class="text-xs text-mut">
                  {{ item.product?.name ?? 'Producto' }}
                  @if (item.batch) {
                    · {{ item.batch.batchCode }}
                  }
                </span>
              </button>
            }
          </div>
        }
      </section>

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
                <div class="text-xs text-mut break-all font-mono">{{ twin.id }}</div>
              </div>
            </section>

            @if (canShip() || canReceive() || canInvoice()) {
              <section class="card">
                <h2 class="text-sm font-semibold mb-3">Acciones</h2>

                <div class="flex flex-wrap gap-2">
                  @if (canShip()) {
                    <button type="button" class="btn-primary" [disabled]="acting()" (click)="ship()">
                      {{ acting() ? 'Procesando…' : 'Enviar caso' }}
                    </button>
                  }
                  @if (canReceive()) {
                    <button type="button" class="btn-primary" [disabled]="acting()" (click)="receive()">
                      {{ acting() ? 'Procesando…' : 'Recibir caso' }}
                    </button>
                  }
                </div>

                @if (canInvoice()) {
                  <div class="mt-3 space-y-2">
                    <input
                      [(ngModel)]="invoiceNumber"
                      name="invoiceNumber"
                      class="field"
                      placeholder="Nº de factura, ej. INV-2026-0004"
                    />
                    <input
                      [(ngModel)]="invoiceRecipient"
                      name="invoiceRecipient"
                      class="field"
                      placeholder="UUID del nuevo propietario (opcional)"
                    />
                    <button type="button" class="btn-primary" [disabled]="acting()" (click)="invoice()">
                      {{ acting() ? 'Procesando…' : 'Registrar factura' }}
                    </button>
                  </div>
                }

                @if (actionError()) {
                  <div class="text-sm mt-3" style="color: #f08a8a">{{ actionError() }}</div>
                }
                @if (actionMessage()) {
                  <div class="text-sm mt-3" style="color: #5ec88a">{{ actionMessage() }}</div>
                }
              </section>
            }

            <section class="card">
              <h2 class="text-sm font-semibold mb-3">Avisos vinculados</h2>
              @if (notices().length === 0) {
                <p class="text-sm text-mut">No hay avisos para este producto.</p>
              } @else {
                <div class="space-y-2">
                  @for (notice of notices(); track notice.id) {
                    <button type="button" class="notice-link" (click)="goToNotice(notice.id)">
                      <span class="text-sm">{{ notice.title }}</span>
                      <span class="text-xs text-mut">{{ notice.type }}</span>
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
                        <span class="text-sm font-medium">{{ entryLabel(entry) }}</span>
                        <span class="text-xs text-mut">{{ actorName(entry.actorId) }}</span>
                      </div>
                      <div class="text-xs text-mut mt-1">
                        {{ date(entry.eventTime) }}
                        @if (entry.bizTransactionId) {
                          <span>
                            · {{ txnTypeLabel(entry.bizTransactionType) }}:
                            {{ entry.bizTransactionId }}
                          </span>
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
    .case-row {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      align-items: flex-start;
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
    }
    .case-row:hover {
      border-color: var(--color-accent);
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
  private readonly auth = inject(Auth);
  private readonly directory = inject(Directory);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  query = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly epc = signal<Epc | null>(null);
  readonly history = signal<EpcHistoryEntry[]>([]);
  readonly notices = signal<Notice[]>([]);
  readonly myCases = signal<Epc[]>([]);

  readonly myActorId = signal<string | null>(null);
  readonly acting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);

  invoiceNumber = '';
  invoiceRecipient = '';

  private readonly resolvedActors = new Set<string>();

  ngOnInit(): void {
    this.auth
      .me()
      .then((me) => this.myActorId.set(me.actor?.id ?? me.user.actorId))
      .catch(() => this.myActorId.set(null));

    void this.loadCases();

    const epc = this.route.snapshot.queryParamMap.get('epc');
    if (epc) {
      this.query = epc;
      this.load(epc);
    }
  }

  ngAfterViewChecked(): void {
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
    this.actionError.set(null);
    this.actionMessage.set(null);
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
        this.error.set(this.messageFrom(err, 'EPC no encontrado o sin acceso.'));
      })
      .finally(() => this.busy.set(false));
  }

  canShip(): boolean {
    const twin = this.epc();
    return !!twin && twin.status === 'active' && this.isCustodian(twin);
  }

  canReceive(): boolean {
    const twin = this.epc();
    return (
      !!twin &&
      twin.status === 'in_transit' &&
      (this.isOwner(twin) || this.isCustodian(twin))
    );
  }

  canInvoice(): boolean {
    const twin = this.epc();
    return !!twin && this.isOwner(twin);
  }

  ship(): void {
    const twin = this.epc();
    if (!twin) return;
    void this.runAction(() => this.api.shipEpc(twin.id), 'Caso enviado.');
  }

  receive(): void {
    const twin = this.epc();
    if (!twin) return;
    void this.runAction(() => this.api.receiveEpc(twin.id), 'Caso recibido.');
  }

  invoice(): void {
    const twin = this.epc();
    if (!twin) return;
    const bizTransactionId = this.invoiceNumber.trim();
    if (!bizTransactionId) {
      this.actionError.set('Ingresa el número de factura.');
      return;
    }
    const recipient = this.invoiceRecipient.trim();
    void this.runAction(
      () =>
        this.api.invoiceEpc(twin.id, {
          bizTransactionId,
          ownershipTransferTo: recipient || undefined,
        }),
      'Factura registrada.',
    );
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

  short(urn: string): string {
    const parts = urn.split(':');
    return parts[parts.length - 1].slice(0, 8);
  }

  goToNotice(noticeId: string): void {
    void this.router.navigate(['/notices'], {
      queryParams: { notice: noticeId },
    });
  }

  private isOwner(twin: Epc): boolean {
    const id = this.myActorId();
    return !!id && twin.ownerActorId === id;
  }

  private isCustodian(twin: Epc): boolean {
    const id = this.myActorId();
    return !!id && twin.custodianActorId === id;
  }

  private async loadCases(): Promise<void> {
    try {
      this.myCases.set(await this.api.listEpcs());
    } catch {
      this.myCases.set([]);
    }
  }

  private async runAction(
    action: () => Promise<Epc>,
    successMessage: string,
  ): Promise<void> {
    const twin = this.epc();
    if (!twin) return;

    this.acting.set(true);
    this.actionError.set(null);
    this.actionMessage.set(null);

    try {
      await action();
      this.actionMessage.set(successMessage);
      this.invoiceNumber = '';
      this.invoiceRecipient = '';
      this.load(twin.id);
      await this.loadCases();
    } catch (err: unknown) {
      this.actionError.set(this.messageFrom(err, 'No se pudo completar la acción.'));
    } finally {
      this.acting.set(false);
    }
  }

  private messageFrom(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string' ? message : fallback;
  }
}
