import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { Api } from '../../core/api.service';
import { activityLabel } from '../../core/labels';
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
          Bienvenido de nuevo, {{ me()?.user?.fullName ?? '…' }}. Este es el
          estado de tu organización.
        </p>
      </div>

      @if (onboarded()) {
        <div class="alert-success">
          Configuración completada. Ya puedes crear productos, generar casos y
          moverlos.
        </div>
      }

      <div class="grid gap-4 md:grid-cols-3">
        <div class="card">
          <div class="text-xs uppercase tracking-wide text-mut">Organización</div>
          <div class="text-lg font-medium mt-1">
            {{ me()?.actor?.name ?? 'Sin vincular' }}
          </div>
          @if (activityNames()) {
            <div class="text-sm text-mut mt-1">{{ activityNames() }}</div>
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

      @if (products().length === 0 || cases().length === 0) {
        <section class="card">
          <h2 class="text-sm font-semibold">Primeros pasos</h2>
          <p class="text-sm text-mut mt-1">
            Completa estos pasos para empezar a trazar. Puedes volver a esta
            lista cuando quieras.
          </p>
          <div class="onboarding-list">
            <a routerLink="/products" class="onboarding-step" [class.done]="products().length > 0">
              <span class="check">{{ products().length > 0 ? '✓' : '1' }}</span>
              <span>
                <span class="step-name">Crea tu primer producto y lote</span>
                <span class="step-hint">
                  El producto es el catálogo; el lote agrupa unidades fabricadas
                  juntas.
                </span>
              </span>
            </a>
            <a routerLink="/products" class="onboarding-step" [class.done]="cases().length > 0">
              <span class="check">{{ cases().length > 0 ? '✓' : '2' }}</span>
              <span>
                <span class="step-name">Genera tu primer caso (caja)</span>
                <span class="step-hint">
                  Cada caso recibe un EPC único: es la unidad que se mueve y se
                  rastrea.
                </span>
              </span>
            </a>
            <a routerLink="/guide" class="onboarding-step">
              <span class="check">3</span>
              <span>
                <span class="step-name">Lee la guía rápida</span>
                <span class="step-hint">
                  Te explica los conceptos y el flujo completo en 5 pasos.
                </span>
              </span>
            </a>
          </div>
        </section>
      }

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
              <span class="text-sm">Productos y casos</span>
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
            <a routerLink="/guide" class="quick">
              <span class="text-sm">Guía rápida</span>
              <span class="text-xs text-mut">Conceptos y flujo explicados desde cero</span>
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
    .alert-success {
      padding: 0.65rem 0.85rem;
      border-radius: 0.55rem;
      border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
      background: color-mix(in srgb, var(--color-success) 8%, transparent);
      color: var(--color-success);
      font-size: 0.875rem;
    }
    .onboarding-list {
      display: grid;
      gap: 0.6rem;
      margin-top: 0.9rem;
    }
    .onboarding-step {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      padding: 0.7rem 0.8rem;
      border-radius: 0.55rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
      text-decoration: none;
    }
    .onboarding-step:hover {
      border-color: var(--color-accent);
    }
    .onboarding-step.done {
      opacity: 0.75;
    }
    .check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 9999px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      font-size: 0.75rem;
      font-weight: 700;
      flex: none;
    }
    .onboarding-step.done .check {
      background: var(--color-success);
      border-color: var(--color-success);
      color: #0b0f17;
    }
    .step-name {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .step-hint {
      display: block;
      font-size: 0.78rem;
      color: var(--color-mut);
      margin-top: 0.1rem;
      line-height: 1.35;
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly auth = inject(Auth);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly meState = signal<MeResponse | null>(null);
  readonly me = this.meState.asReadonly();
  readonly products = signal<Product[]>([]);
  readonly cases = signal<Epc[]>([]);
  readonly onboarded = signal(
    this.route.snapshot.queryParamMap.get('onboarded') === '1',
  );
  readonly activityNames = computed(() =>
    (this.meState()?.actor?.activities ?? [])
      .map((activity) => activityLabel(activity.code, activity.name))
      .join(' · '),
  );

  ngOnInit(): void {
    this.auth
      .me()
      .then((me) => {
        this.meState.set(me);
        if (
          me.actor &&
          me.actor.activities.length === 0 &&
          me.user.roles.includes('owner')
        ) {
          void this.router.navigate(['/onboarding'], { replaceUrl: true });
        }
      })
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
