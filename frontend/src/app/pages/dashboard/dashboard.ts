import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { Api } from '../../core/api.service';
import { Directory } from '../../core/directory.service';
import { DEMO_EPCS, DEMO_NOTICES } from '../../core/demo';
import type { MeResponse, Product } from '../../core/models';

@Component({
  selector: 'app-dashboard',
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
          <div class="text-xs uppercase tracking-wide text-mut">Tus productos</div>
          <div class="text-lg font-medium mt-1">{{ products().length }}</div>
          <div class="text-sm text-mut mt-1">en tu catálogo</div>
        </div>
        <div class="card">
          <div class="text-xs uppercase tracking-wide text-mut">Avisos</div>
          <div class="text-lg font-medium mt-1">{{ notices() }}</div>
          <div class="text-sm text-mut mt-1">vinculados a tus productos</div>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 class="text-sm font-semibold mb-3">Trazabilidad rápida</h2>
          <div class="grid gap-2">
            @for (epc of demoEpcs; track epc.urn) {
              <button
                type="button"
                class="demo-link"
                (click)="goToTrace(epc.urn)"
              >
                <span class="font-mono text-xs">{{ short(epc.urn) }}</span>
                <span class="text-xs text-mut">{{ epc.label }}</span>
              </button>
            }
          </div>
        </section>

        <section>
          <h2 class="text-sm font-semibold mb-3">Avisos de ejemplo</h2>
          <div class="grid gap-2">
            @for (notice of demoNotices; track notice.id) {
              <button
                type="button"
                class="demo-link"
                (click)="goToNotice(notice.id)"
              >
                <span class="text-sm">{{ notice.title }}</span>
              </button>
            }
            @if (!demoNotices.length) {
              <p class="text-sm text-mut">No hay avisos de ejemplo configurados.</p>
            }
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
    .demo-link {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      align-items: flex-start;
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-ink);
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .demo-link:hover {
      border-color: var(--color-accent);
      background: var(--color-surface-2);
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly auth = inject(Auth);
  private readonly api = inject(Api);
  private readonly directory = inject(Directory);
  private readonly router = inject(Router);

  private readonly meState = signal<MeResponse | null>(null);
  readonly me = this.meState.asReadonly();
  readonly products = signal<Product[]>([]);
  readonly notices = signal(0);
  readonly demoEpcs = DEMO_EPCS;
  readonly demoNotices = DEMO_NOTICES;

  ngOnInit(): void {
    this.auth.me().then((me) => {
      this.meState.set(me);
      if (me.actor) {
        void this.directory.get(me.actor.id);
      }
      this.loadProducts();
    });
  }

  private loadProducts(): void {
    this.api
      .listProducts()
      .then((products) => {
        this.products.set(products);
        const ids = products.map((p) => p.id);
        if (ids.length === 0) {
          this.notices.set(0);
          return;
        }
        Promise.all(
          ids.map((id) => this.api.listNotices(id).then((n) => n.length)),
        ).then((counts) => this.notices.set(counts.reduce((a, b) => a + b, 0)));
      })
      .catch(() => {
        this.products.set([]);
      });
  }

  short(urn: string): string {
    const parts = urn.split(':');
    return parts[parts.length - 1].slice(0, 8);
  }

  goToTrace(urn: string): void {
    void this.router.navigate(['/trace'], { queryParams: { epc: urn } });
  }

  goToNotice(noticeId: string): void {
    void this.router.navigate(['/notices'], {
      queryParams: { notice: noticeId },
    });
  }
}
