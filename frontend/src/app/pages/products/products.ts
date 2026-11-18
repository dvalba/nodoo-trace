import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import type { Batch, Product } from '../../core/models';

interface ProductWithBatches {
  product: Product;
  batches: Batch[];
}

interface CreatedCase {
  urn: string;
  productName: string;
  batchCode: string;
}

@Component({
  selector: 'app-products',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Productos y casos</h1>
        <p class="text-sm text-mut mt-1">
          Un producto agrupa lotes y cada lote agrupa casos. El caso (una caja
          con EPC) es la unidad que se mueve y se rastrea; los pallets no se
          serializan.
        </p>
      </div>

      <section class="card">
        <h2 class="text-sm font-semibold mb-3">Paso 1 · Crea un producto</h2>
        <form (ngSubmit)="createProduct()" class="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div>
            <label class="block text-sm mb-1" for="sku">SKU</label>
            <input
              id="sku"
              name="sku"
              [(ngModel)]="sku"
              class="field"
              placeholder="VAC-FLU-05"
            />
          </div>
          <div>
            <label class="block text-sm mb-1" for="name">Nombre</label>
            <input
              id="name"
              name="name"
              [(ngModel)]="name"
              class="field"
              placeholder="Vacuna antigripal 0.5 mL"
            />
          </div>
          <button type="submit" [disabled]="productBusy()" class="btn-primary">
            {{ productBusy() ? 'Creando…' : 'Crear producto' }}
          </button>
        </form>
        @if (productError()) {
          <div class="text-sm mt-3" style="color: var(--color-danger)">{{ productError() }}</div>
        }
      </section>

      @if (loading()) {
        <p class="text-sm text-mut">Cargando productos…</p>
      } @else if (rows().length === 0) {
        <p class="text-sm text-mut">
          Aún no hay productos. Crea el primero arriba para empezar a generar lotes y casos.
        </p>
      } @else {
        <div class="grid gap-4">
          @for (row of rows(); track row.product.id) {
            <div class="card">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="text-lg font-medium">{{ row.product.name }}</div>
                  <div class="text-xs text-mut mt-0.5">SKU {{ row.product.sku }}</div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm text-mut">{{ row.batches.length }} lote(s)</span>
                  <button type="button" class="link" (click)="goToNotice(row.product.id)">
                    Ver avisos
                  </button>
                </div>
              </div>

              @if (row.batches.length > 0) {
                <div class="mt-4 border-t border-border pt-3">
                  <div class="text-xs uppercase tracking-wide text-mut mb-2">Lotes</div>
                  <div class="flex flex-wrap gap-2">
                    @for (batch of row.batches; track batch.id) {
                      <span class="chip">{{ batch.batchCode }}</span>
                    }
                  </div>
                </div>
              }

              <div class="mt-4 grid gap-4 border-t border-border pt-3 lg:grid-cols-2">
                <div>
                  <div class="text-xs uppercase tracking-wide text-mut mb-2">Paso 2 · Añade un lote</div>
                  <div class="flex gap-2">
                    <input
                      [(ngModel)]="batchCodes[row.product.id]"
                      [name]="'batch-' + row.product.id"
                      class="field"
                      placeholder="LOTE-2026-1117-A"
                    />
                    <button
                      type="button"
                      class="btn-primary"
                      [disabled]="batchBusy()[row.product.id]"
                      (click)="createBatch(row.product.id)"
                    >
                      {{ batchBusy()[row.product.id] ? '…' : 'Añadir' }}
                    </button>
                  </div>
                  @if (batchError()[row.product.id]) {
                    <div class="text-xs mt-2" style="color: var(--color-danger)">
                      {{ batchError()[row.product.id] }}
                    </div>
                  }
                </div>

                <div>
                  <div class="text-xs uppercase tracking-wide text-mut mb-2">
                    Paso 3 · Genera casos (cajas)
                  </div>
                  @if (!canCommission()) {
                    <p class="text-xs text-mut">
                      Tu actividad no incluye crear identidades de producto
                      (comisionar). Puedes preparar catálogo y lotes, pero no
                      generar casos.
                    </p>
                  } @else if (row.batches.length === 0) {
                    <p class="text-xs text-mut">Crea un lote para poder generar casos.</p>
                  } @else {
                    <div class="flex flex-wrap gap-2">
                      <select
                        [(ngModel)]="caseBatch[row.product.id]"
                        [name]="'case-batch-' + row.product.id"
                        class="field"
                      >
                        @for (batch of row.batches; track batch.id) {
                          <option [value]="batch.id">{{ batch.batchCode }}</option>
                        }
                      </select>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        [(ngModel)]="caseCount[row.product.id]"
                        [name]="'case-count-' + row.product.id"
                        class="field count"
                      />
                      <button
                        type="button"
                        class="btn-primary"
                        [disabled]="caseBusy()"
                        (click)="commission(row.product)"
                      >
                        {{ caseBusy() ? 'Generando…' : 'Generar' }}
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (caseError()) {
        <div class="text-sm" style="color: var(--color-danger)">{{ caseError() }}</div>
      }

      @if (createdCases().length > 0) {
        <section class="card">
          <h2 class="text-sm font-semibold mb-3">
            Casos creados en esta sesión · {{ createdCases().length }}
          </h2>
          <div class="grid gap-2">
            @for (item of createdCases(); track item.urn) {
              <button type="button" class="case-row" (click)="goToTrace(item.urn)">
                <span class="font-mono text-xs">{{ short(item.urn) }}</span>
                <span class="text-xs text-mut">
                  {{ item.productName }} · {{ item.batchCode }}
                </span>
              </button>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
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
    .field.count {
      width: 5rem;
      flex: 0 0 auto;
    }
    .btn-primary {
      padding: 0.5rem 0.9rem;
      border-radius: 0.5rem;
      background: var(--color-accent);
      color: var(--color-accent-ink);
      font-size: 0.875rem;
      font-weight: 600;
      white-space: nowrap;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .chip {
      display: inline-flex;
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      font-size: 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .link {
      color: var(--color-accent);
      font-size: 0.875rem;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
    }
    .link:hover {
      text-decoration: underline;
    }
    .case-row {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      align-items: flex-start;
      text-align: left;
      padding: 0.55rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
    }
    .case-row:hover {
      border-color: var(--color-accent);
    }
  `,
})
export class Products implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly myOperations = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal(true);
  readonly rows = signal<ProductWithBatches[]>([]);

  sku = '';
  name = '';
  readonly productBusy = signal(false);
  readonly productError = signal<string | null>(null);

  batchCodes: Record<string, string> = {};
  readonly batchBusy = signal<Record<string, boolean>>({});
  readonly batchError = signal<Record<string, string | null>>({});

  caseBatch: Record<string, string> = {};
  caseCount: Record<string, number> = {};
  readonly caseBusy = signal(false);
  readonly caseError = signal<string | null>(null);
  readonly createdCases = signal<CreatedCase[]>([]);

  ngOnInit(): void {
    this.auth
      .refreshMe()
      .then((me) =>
        this.myOperations.set(new Set(me.actor?.operations ?? [])),
      )
      .catch(() => this.myOperations.set(new Set()));
    void this.load();
  }

  canCommission(): boolean {
    return this.myOperations().has('object:commissioning');
  }

  createProduct(): void {
    const sku = this.sku.trim();
    const name = this.name.trim();
    if (!sku || !name) {
      this.productError.set('Completa el SKU y el nombre del producto.');
      return;
    }

    this.productBusy.set(true);
    this.productError.set(null);

    this.api
      .createProduct({ sku, name })
      .then(() => {
        this.sku = '';
        this.name = '';
        return this.load();
      })
      .catch((err: unknown) => this.productError.set(this.messageFrom(err)))
      .finally(() => this.productBusy.set(false));
  }

  createBatch(productId: string): void {
    const code = (this.batchCodes[productId] ?? '').trim();
    if (!code) {
      this.setBatchError(productId, 'Ingresa el código del lote.');
      return;
    }

    this.setBatchBusy(productId, true);
    this.setBatchError(productId, null);

    this.api
      .createBatch(productId, { batchCode: code })
      .then(() => {
        this.batchCodes[productId] = '';
        return this.load();
      })
      .catch((err: unknown) => this.setBatchError(productId, this.messageFrom(err)))
      .finally(() => this.setBatchBusy(productId, false));
  }

  async commission(product: Product): Promise<void> {
    const batchId = this.caseBatch[product.id];
    if (!batchId) {
      this.caseError.set('Crea un lote antes de generar casos.');
      return;
    }

    const batch = this.rows()
      .find((row) => row.product.id === product.id)
      ?.batches.find((item) => item.id === batchId);

    const count = Math.max(
      1,
      Math.min(50, Number(this.caseCount[product.id]) || 1),
    );

    this.caseBusy.set(true);
    this.caseError.set(null);

    try {
      const created: CreatedCase[] = [];
      for (let i = 0; i < count; i += 1) {
        const epc = await this.api.commissionEpc({
          productId: product.id,
          batchId,
        });
        created.push({
          urn: epc.id,
          productName: product.name,
          batchCode: batch?.batchCode ?? '',
        });
      }
      this.createdCases.update((list) => [...created, ...list]);
    } catch (err: unknown) {
      this.caseError.set(this.messageFrom(err));
    } finally {
      this.caseBusy.set(false);
    }
  }

  goToTrace(urn: string): void {
    void this.router.navigate(['/trace'], { queryParams: { epc: urn } });
  }

  goToNotice(productId: string): void {
    void this.router.navigate(['/notices'], {
      queryParams: { product: productId },
    });
  }

  short(urn: string): string {
    const parts = urn.split(':');
    return parts[parts.length - 1].slice(0, 8);
  }

  private load(): Promise<void> {
    this.loading.set(true);

    return this.api
      .listProducts()
      .then(async (products) => {
        const rows = await Promise.all(
          products.map(async (product) => ({
            product,
            batches: await this.api
              .listBatches(product.id)
              .catch(() => [] as Batch[]),
          })),
        );

        for (const row of rows) {
          const id = row.product.id;
          if (this.batchCodes[id] === undefined) {
            this.batchCodes[id] = '';
          }
          if (
            row.batches.length > 0 &&
            !this.caseBatch[id]
          ) {
            this.caseBatch[id] = row.batches[0].id;
          }
          if (!this.caseCount[id]) {
            this.caseCount[id] = 1;
          }
        }

        this.rows.set(rows);
      })
      .catch(() => this.rows.set([]))
      .finally(() => this.loading.set(false));
  }

  private setBatchBusy(productId: string, value: boolean): void {
    this.batchBusy.update((map) => ({ ...map, [productId]: value }));
  }

  private setBatchError(productId: string, value: string | null): void {
    this.batchError.update((map) => ({ ...map, [productId]: value }));
  }

  private messageFrom(err: unknown): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    if (typeof message === 'string') {
      return message;
    }
    return 'No se pudo completar la operación.';
  }
}
