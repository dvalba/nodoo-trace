import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { Api } from '../../core/api.service';
import type { Epc, EpcStatus, MeResponse, Product } from '../../core/models';

const STATUS_LABELS: Record<EpcStatus, string> = {
  active: 'Activo',
  in_transit: 'En tránsito',
  in_progress: 'En proceso',
  consumed: 'Consumido',
  damaged: 'Dañado',
  expired: 'Vencido',
};

const STATUS_STYLES: Record<EpcStatus, string> = {
  active: '#5ec88a',
  in_transit: '#6aa9e8',
  in_progress: '#e0b458',
  consumed: '#8a97ad',
  damaged: '#f08a8a',
  expired: '#c98ad6',
};

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Inicio</h1>
        <p class="text-sm text-mut mt-1">
          Bienvenido de nuevo, {{ me()?.user?.fullName ?? '…' }}.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="card">
          <div class="text-xs uppercase tracking-wide text-mut">Organización</div>
          <div class="text-lg font-medium mt-1">
            {{ me()?.actor?.name ?? 'Sin vincular' }}
          </div>
          @let actor = me()?.actor;
          @if (actor) {
            <div class="text-sm text-mut mt-1">
              {{ actor.activities.map((a) => a.name).join(' · ') }}
            </div>
          }
        </div>
        <div class="card">
          <div class="text-xs uppercase tracking-wide text-mut">Productos</div>
          <div class="text-lg font-medium mt-1">{{ products().length }}</div>
          <div class="text-sm text-mut mt-1">en tu catálogo</div>
        </div>
        <div class="card">
          <div class="text-xs uppercase tracking-wide text-mut">Casos</div>
          <div class="text-lg font-medium mt-1">{{ cases().length }}</div>
          <div class="text-sm text-mut mt-1">visibles para tu organización</div>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="card">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold">Mis casos recientes</h2>
            <a routerLink="/trace" class="link">Ver todos</a>
          </div>
          @if (cases().length === 0) {
            <p class="text-sm text-mut">
              Aún no hay casos. Genera el primero desde
              <a routerLink="/products" class="link">Productos</a>.
            </p>
          } @else {
            <div class="grid gap-2">
              @for (item of cases().slice(0, 6); track item.id) {
                <button type="button" class="case-row" (click)="goToTrace(item.id)">
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

        <section class="card">
          <h2 class="text-sm font-semibold mb-3">Accesos rápidos</h2>
          <div class="grid gap-2">
            <a routerLink="/products" class="quick">
              <span class="text-sm">Productos y lotes</span>
              <span class="text-xs text-mut">Crea catálogo y genera casos</span>
            </a>
            <a routerLink="/trace" class="quick">
              <span class="text-sm">Trazabilidad</span>
              <span class="text-xs text-mut">Consulta el historial de un caso</span>
            </a>
            <a routerLink="/notices" class="quick">
              <span class="text-sm">Avisos</span>
              <span class="text-xs text-mut">Publica retiros y reconoce avisos</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
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
    .quick {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink) !important;
    }
    .quick:hover {
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
    .link {
      color: var(--color-accent) !important;
      font-size: 0.8rem;
      text-decoration: none;
    }
    .link:hover {
      text-decoration: underline;
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly auth = inject(Auth);
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  private readonly meState = signal<MeResponse | null>(null);
  readonly me = this.meState.asReadonly();
  readonly products = signal<Product[]>([]);
  readonly cases = signal<Epc[]>([]);

  ngOnInit(): void {
    this.auth
      .me()
      .then((me) => this.meState.set(me))
      .catch(() => this.meState.set(null));

    this.api
      .listProducts()
      .then((products) => this.products.set(products))
      .catch(() => this.products.set([]));

    this.api
      .listEpcs()
      .then((cases) => this.cases.set(cases))
      .catch(() => this.cases.set([]));
  }

  statusLabel(status: EpcStatus): string {
    return STATUS_LABELS[status] ?? status.replace('_', ' ');
  }

  statusColor(status: EpcStatus): string {
    return STATUS_STYLES[status] ?? '#8a97ad';
  }

  short(urn: string): string {
    const parts = urn.split(':');
    return parts[parts.length - 1].slice(0, 8);
  }

  goToTrace(urn: string): void {
    void this.router.navigate(['/trace'], { queryParams: { epc: urn } });
  }
}
