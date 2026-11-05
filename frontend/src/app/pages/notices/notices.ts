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
import { DEMO_NOTICES, DEMO_PRODUCTS } from '../../core/demo';
import type { Notice, NoticeAck } from '../../core/models';

@Component({
  selector: 'app-notices',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Avisos</h1>
        <p class="text-sm text-mut mt-1">
          Retiros y avisos emitidos contra productos y lotes.
        </p>
      </div>

      <div class="card">
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-sm text-mut">Producto</span>
          <select
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
        <div class="mt-3">
            <div class="text-xs uppercase tracking-wide text-mut mb-2">
            Avisos de ejemplo
          </div>
          <div class="flex flex-wrap gap-2">
            @for (notice of demoNotices; track notice.id) {
              <button
                type="button"
                class="chip"
                (click)="openNotice(notice.id)"
              >
                {{ notice.title }}
              </button>
            }
          </div>
        </div>
      </div>

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
                {{ n.product?.name ?? 'Producto desconocido' }}
                @if (n.batchId) {
                  <span> · lote {{ n.batchId.slice(0, 8) }}</span>
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
            Selecciona un producto arriba o abre un aviso de ejemplo para ver los detalles.
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
    .chip {
      padding: 0.35rem 0.7rem;
      border-radius: 9999px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
      font-size: 0.75rem;
    }
    .chip:hover {
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
  readonly products = signal<{ id: string; name: string }[]>([]);
  readonly notice = signal<Notice | null>(null);
  readonly acks = signal<NoticeAck[]>([]);
  readonly acking = signal(false);
  readonly acked = computed(() => {
    const id = this.myActorId();
    if (!id) {
      return false;
    }
    return this.acks().some((a) => a.actorId === id);
  });
  readonly demoNotices = DEMO_NOTICES;

  private readonly resolvedActors = new Set<string>();

  ngOnInit(): void {
    this.auth.me().then((me) => {
      this.myActorId.set(me.actor?.id ?? me.user.actorId);
    });

    // Populate the product select with the user's own products plus demo
    // products, so non-owners can still drill into a shared notice.
    Promise.all([this.api.listProducts(), Promise.resolve(DEMO_PRODUCTS)])
      .then(([own, demo]) => {
        const seen = new Set<string>();
        const all = [...own.map((p) => ({ id: p.id, name: p.name })), ...demo];
        this.products.set(
          all.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))),
        );
      })
      .catch(() => this.products.set(DEMO_PRODUCTS));

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
    const ackIds = this.acks().map((a) => a.actorId);
    ackIds.forEach((id) => {
      if (!this.resolvedActors.has(id)) {
        this.resolvedActors.add(id);
        void this.directory.get(id);
      }
    });
  }

  selectProduct(): void {
    const id = this.selectedProduct;
    if (id) {
      this.listForProduct(id);
    } else {
      this.notice.set(null);
      this.acks.set([]);
    }
  }

  private listForProduct(productId: string): void {
    this.api
      .listNotices(productId)
      .then((notices) => {
        if (notices.length === 0) {
          this.notice.set(null);
          return;
        }
        this.openNotice(notices[0].id);
      })
      .catch(() => this.notice.set(null));
  }

  openNotice(noticeId: string): void {
    Promise.all([this.api.getNotice(noticeId), this.api.listAcks(noticeId)])
      .then(([notice, acks]) => {
        this.notice.set(notice);
        this.acks.set(acks);
        if (notice.productId) {
          this.selectedProduct = notice.productId;
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
        if (!existing.some((a) => a.id === ack.id)) {
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
}
