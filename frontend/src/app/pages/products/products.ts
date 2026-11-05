import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api.service';
import type { Batch, Product } from '../../core/models';

interface ProductWithBatches {
  product: Product;
  batches: Batch[];
}

@Component({
  selector: 'app-products',
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Productos</h1>
        <p class="text-sm text-mut mt-1">Catálogo de tu organización.</p>
      </div>

      @if (loading()) {
        <p class="text-sm text-mut">Cargando productos…</p>
      } @else if (rows().length === 0) {
        <p class="text-sm text-mut">
          Aún no hay productos. Los productos que crees aparecerán aquí con sus lotes.
        </p>
      } @else {
        <div class="grid gap-4">
          @for (row of rows(); track row.product.id) {
            <div class="card">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="text-lg font-medium">{{ row.product.name }}</div>
                  <div class="text-xs text-mut mt-0.5">
                    SKU {{ row.product.sku }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm">{{ row.batches.length }} lote(s)</div>
                  <button
                    type="button"
                    class="link"
                    (click)="goToNotice(row.product.id)"
                  >
                    Ver avisos
                  </button>
                </div>
              </div>

              @if (row.batches.length > 0) {
                <div class="mt-4 border-t border-border pt-3">
                  <div class="text-xs uppercase tracking-wide text-mut mb-2">
                    Lotes
                  </div>
                  <div class="flex flex-wrap gap-2">
                    @for (batch of row.batches; track batch.id) {
                      <span class="chip">{{ batch.batchCode }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
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
  `,
})
export class Products implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly rows = signal<ProductWithBatches[]>([]);

  ngOnInit(): void {
    this.api
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
        this.rows.set(rows);
      })
      .catch(() => this.rows.set([]))
      .finally(() => this.loading.set(false));
  }

  goToNotice(productId: string): void {
    void this.router.navigate(['/notices'], {
      queryParams: { product: productId },
    });
  }
}
