import {
  AfterViewChecked,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Directory } from '../../core/directory.service';
import type {
  Batch,
  Notice,
  NoticeAck,
  NoticeType,
  Product,
} from '../../core/models';

@Component({
  selector: 'app-notices',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Avisos</h1>
        <p class="text-sm text-mut mt-1">
          Un aviso alerta sobre un producto, lote o caso. Un retiro pide
          devolver o inmovilizar las unidades afectadas y los implicados deben
          reconocerlo.
        </p>
      </div>

      <div class="card">
        <div class="flex flex-wrap gap-2 items-end">
          <div class="flex-1 min-w-[220px]">
            <label class="block text-sm mb-1" for="product">Producto</label>
            <select
              id="product"
              [(ngModel)]="selectedProduct"
              (change)="selectProduct()"
              class="field"
            >
              <option value="">Selecciona un producto…</option>
              @for (product of products(); track product.id) {
                <option [value]="product.id">{{ product.name }}</option>
              }
            </select>
          </div>
          <button
            type="button"
            class="btn-primary"
            [disabled]="!selectedProduct"
            (click)="toggleCreate()"
          >
            {{ showCreate() ? 'Cancelar' : 'Nuevo aviso' }}
          </button>
        </div>

        @if (showCreate()) {
          <div class="mt-4 border-t border-border pt-4 space-y-3">
            <div class="grid gap-3 sm:grid-cols-[auto_1fr]">
              <div>
                <label class="block text-sm mb-1" for="type">Tipo</label>
                <select id="type" name="type" [(ngModel)]="newNotice.type" class="field">
                  <option value="advisory">Aviso</option>
                  <option value="recall">Retiro</option>
                </select>
              </div>
              <div>
                <label class="block text-sm mb-1" for="title">Título</label>
                <input
                  id="title"
                  name="title"
                  [(ngModel)]="newNotice.title"
                  class="field"
                  placeholder="Retiro preventivo — lote …"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm mb-1" for="description">Descripción</label>
              <textarea
                id="description"
                name="description"
                [(ngModel)]="newNotice.description"
                class="field"
                rows="3"
                placeholder="Detalle del aviso o retiro…"
              ></textarea>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="block text-sm mb-1" for="batch">Lote afectado</label>
                <select id="batch" name="batch" [(ngModel)]="newNotice.batchId" class="field">
                  <option value="">—</option>
                  @for (batch of batches(); track batch.id) {
                    <option [value]="batch.id">{{ batch.batchCode }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="block text-sm mb-1" for="epcIds">
                  EPCs afectados <span class="text-mut">(separados por coma)</span>
                </label>
                <input
                  id="epcIds"
                  name="epcIds"
                  [(ngModel)]="newNotice.epcIds"
                  class="field font-mono text-xs"
                  placeholder="urn:nodoo:epc:…, urn:nodoo:epc:…"
                />
              </div>
            </div>

            @if (createError()) {
              <div class="text-sm" style="color: var(--color-danger)">{{ createError() }}</div>
            }

            <button type="button" class="btn-primary" [disabled]="createBusy()" (click)="createNotice()">
              {{ createBusy() ? 'Publicando…' : 'Publicar aviso' }}
            </button>
          </div>
        }
      </div>

      @if (selectedProduct) {
        <section class="card">
          <h2 class="text-sm font-semibold mb-3">
            Avisos del producto · {{ notices().length }}
          </h2>
          @if (notices().length === 0) {
            <p class="text-sm text-mut">Este producto no tiene avisos.</p>
          } @else {
            <div class="grid gap-2">
              @for (item of notices(); track item.id) {
                <button type="button" class="notice-row" (click)="openNotice(item.id)">
                  <span class="flex items-center gap-2">
                    <span class="badge" [class.recall]="item.type === 'recall'" [class.advisory]="item.type === 'advisory'">
                      {{ typeLabel(item.type) }}
                    </span>
                    <span class="text-sm">{{ item.title }}</span>
                  </span>
                  <span class="text-xs text-mut">{{ date(item.createdAt) }}</span>
                </button>
              }
            </div>
          }
        </section>
      }

      <section class="card">
        @let n = notice();
        @if (n) {
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold">{{ n.title }}</h2>
                <span class="badge" [class.recall]="n.type === 'recall'" [class.advisory]="n.type === 'advisory'">
                  {{ typeLabel(n.type) }}
                </span>
              </div>
              <p class="text-sm text-mut mt-1">
                {{ n.product?.name ?? 'Producto' }}
                @if (batchLabel(n)) {
                  <span> · lote {{ batchLabel(n) }}</span>
                }
              </p>
            </div>
            <button
              type="button"
              class="btn-primary"
              [disabled]="acked() || acking()"
              (click)="ack()"
            >
              @if (acked()) { Reconocido } @else if (acking()) { Reconociendo… } @else { Reconocer }
            </button>
          </div>

          @if (n.description) {
            <p class="text-sm mt-4">{{ n.description }}</p>
          }

          <div class="mt-6">
            <div class="text-xs uppercase tracking-wide text-mut mb-2">
              Reconocimientos · {{ acks().length }}
            </div>
            @if (acks().length === 0) {
              <p class="text-sm text-mut">Aún no hay reconocimientos.</p>
            } @else {
              <ul class="grid gap-2">
                @for (ack of acks(); track ack.id) {
                  <li class="ack-row">
                    <span class="text-sm">{{ actorName(ack.actorId) }}</span>
                    <span class="text-xs text-mut">{{ date(ack.acknowledgedAt) }}</span>
                  </li>
                }
              </ul>
            }
          </div>
        } @else {
          <p class="text-sm text-mut">
            Selecciona un producto y un aviso para ver los detalles, o abre un
            aviso desde la trazabilidad de un caso.
          </p>
        }
      </section>
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
      padding: 0.45rem 0.75rem;
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
    .notice-row {
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
    .notice-row:hover {
      border-color: var(--color-accent);
    }
    .badge {
      display: inline-flex;
      padding: 0.15rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge.recall {
      background: #f08a8a;
      color: #2a0d0d;
    }
    .badge.advisory {
      background: #e0b458;
      color: #2a2008;
    }
    .ack-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }
  `,
})
export class Notices implements OnInit, AfterViewChecked {
  private readonly api = inject(Api);
  private readonly directory = inject(Directory);
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);

  private readonly myActorId = signal<string | null>(null);

  selectedProduct = '';
  readonly products = signal<Product[]>([]);
  readonly batches = signal<Batch[]>([]);
  readonly notices = signal<Notice[]>([]);
  readonly notice = signal<Notice | null>(null);
  readonly acks = signal<NoticeAck[]>([]);
  readonly acking = signal(false);
  readonly acked = computed(() => {
    const id = this.myActorId();
    if (!id) {
      return false;
    }
    return this.acks().some((ack) => ack.actorId === id);
  });

  readonly showCreate = signal(false);
  readonly createBusy = signal(false);
  readonly createError = signal<string | null>(null);

  newNotice: {
    type: NoticeType;
    title: string;
    description: string;
    batchId: string;
    epcIds: string;
  } = {
    type: 'advisory',
    title: '',
    description: '',
    batchId: '',
    epcIds: '',
  };

  private readonly resolvedActors = new Set<string>();

  ngOnInit(): void {
    this.auth
      .me()
      .then((me) => this.myActorId.set(me.actor?.id ?? me.user.actorId))
      .catch(() => this.myActorId.set(null));

    this.api
      .listProducts()
      .then((products) => this.products.set(products))
      .catch(() => this.products.set([]));

    const noticeParam = this.route.snapshot.queryParamMap.get('notice');
    const productParam = this.route.snapshot.queryParamMap.get('product');

    if (noticeParam) {
      this.openNotice(noticeParam);
    } else if (productParam) {
      this.selectedProduct = productParam;
      this.listForProduct(productParam);
    }
  }

  ngAfterViewChecked(): void {
    for (const ack of this.acks()) {
      if (!this.resolvedActors.has(ack.actorId)) {
        this.resolvedActors.add(ack.actorId);
        void this.directory.get(ack.actorId);
      }
    }
  }

  toggleCreate(): void {
    this.createError.set(null);
    this.showCreate.update((value) => !value);
  }

  selectProduct(): void {
    const id = this.selectedProduct;
    this.showCreate.set(false);
    if (!id) {
      this.notices.set([]);
      this.batches.set([]);
      this.notice.set(null);
      this.acks.set([]);
      return;
    }
    this.listForProduct(id);
  }

  createNotice(): void {
    const productId = this.selectedProduct;
    if (!productId) {
      this.createError.set('Selecciona un producto.');
      return;
    }

    const title = this.newNotice.title.trim();
    if (!title) {
      this.createError.set('Ingresa un título para el aviso.');
      return;
    }

    const epcIds = this.newNotice.epcIds
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!this.newNotice.batchId && epcIds.length === 0) {
      this.createError.set('Indica un lote o al menos un EPC afectado.');
      return;
    }

    this.createBusy.set(true);
    this.createError.set(null);

    this.api
      .createNotice(productId, {
        type: this.newNotice.type,
        title,
        description: this.newNotice.description.trim() || undefined,
        batchId: this.newNotice.batchId || undefined,
        epcIds: epcIds.length > 0 ? epcIds : undefined,
      })
      .then((created) => {
        this.newNotice = {
          type: 'advisory',
          title: '',
          description: '',
          batchId: '',
          epcIds: '',
        };
        this.showCreate.set(false);
        return this.listForProduct(productId).then(() =>
          this.openNotice(created.id),
        );
      })
      .catch((err: unknown) => this.createError.set(this.messageFrom(err)))
      .finally(() => this.createBusy.set(false));
  }

  openNotice(noticeId: string): void {
    Promise.all([this.api.getNotice(noticeId), this.api.listAcks(noticeId)])
      .then(([notice, acks]) => {
        this.notice.set(notice);
        this.acks.set(acks);
        if (notice.productId) {
          this.selectedProduct = notice.productId;
          this.api
            .listBatches(notice.productId)
            .then((batches) => this.batches.set(batches))
            .catch(() => this.batches.set([]));
        }
      })
      .catch(() => this.notice.set(null));
  }

  ack(): void {
    const notice = this.notice();
    if (!notice) {
      return;
    }
    this.acking.set(true);
    this.api
      .ackNotice(notice.id)
      .then((ack) => {
        const existing = this.acks();
        if (!existing.some((item) => item.id === ack.id)) {
          this.acks.set([...existing, ack]);
        }
      })
      .catch(() => null)
      .finally(() => this.acking.set(false));
  }

  actorName(id: string): string {
    return this.directory.name(id);
  }

  typeLabel(type: string): string {
    return type === 'recall' ? 'Retiro' : 'Aviso';
  }

  batchLabel(notice: Notice): string {
    if (!notice.batchId) {
      return '';
    }
    return (
      this.batches().find((batch) => batch.id === notice.batchId)?.batchCode ??
      notice.batchId.slice(0, 8)
    );
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

  private listForProduct(productId: string): Promise<void> {
    return Promise.all([
      this.api.listBatches(productId).catch(() => [] as Batch[]),
      this.api.listNotices(productId).catch(() => [] as Notice[]),
    ]).then(([batches, notices]) => {
      this.batches.set(batches);
      this.notices.set(notices);
      if (notices.length > 0) {
        this.openNotice(notices[0].id);
      } else {
        this.notice.set(null);
        this.acks.set([]);
      }
    });
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string'
      ? message
      : 'No se pudo publicar el aviso.';
  }
}
