import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Auth } from '../core/auth.service';
import { Directory } from '../core/directory.service';
import { activityLabel } from '../core/labels';
import type { MeResponse } from '../core/models';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen md:flex">
      <aside
        class="hidden md:flex md:w-64 shrink-0 border-r border-border bg-surface flex-col"
      >
        <div class="px-5 py-5 border-b border-border">
          <div class="brand">NodooTrace</div>
          <div class="brand-sub">Trazabilidad de la cadena de suministro</div>
        </div>

        <div class="px-4 py-4 border-b border-border">
          <div class="text-xs uppercase tracking-wide text-mut">Organización</div>
          <div class="text-sm font-medium mt-1 truncate">
            {{ me()?.actor?.name ?? 'Sin organización' }}
          </div>
          @if (activityNames()) {
            <div class="text-xs text-mut mt-1 leading-snug">
              {{ activityNames() }}
            </div>
          }
        </div>

        <nav class="flex-1 px-3 py-4 space-y-5">
          <div>
            <div class="nav-group">General</div>
            <a
              routerLink="/"
              routerLinkActive="is-active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="nav-item"
            >
              Inicio
            </a>
            <a routerLink="/guide" routerLinkActive="is-active" class="nav-item">
              Guía rápida
            </a>
          </div>
          <div>
            <div class="nav-group">Operación</div>
            <a
              routerLink="/products"
              routerLinkActive="is-active"
              class="nav-item"
            >
              Productos y casos
            </a>
            <a routerLink="/trace" routerLinkActive="is-active" class="nav-item">
              Trazabilidad
            </a>
            <a
              routerLink="/notices"
              routerLinkActive="is-active"
              class="nav-item"
            >
              Avisos
            </a>
          </div>
        </nav>

        <div class="px-3 py-3 border-t border-border">
          <div class="text-sm truncate">{{ me()?.user?.fullName ?? '…' }}</div>
          <div class="text-xs text-mut truncate">
            {{ me()?.user?.email ?? '' }}
          </div>
          <button type="button" class="nav-item w-full text-left mt-2" (click)="auth.logout()">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0">
        <header
          class="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between gap-3 px-4 md:px-6"
        >
          <div class="md:hidden brand">NodooTrace</div>
          <div class="hidden md:block text-sm text-mut truncate">
            {{ me()?.actor?.name ?? 'Tu organización' }}
          </div>
          <div class="flex items-center gap-3">
            <a routerLink="/guide" class="header-link hidden sm:inline">
              ¿Cómo funciona?
            </a>
            <div class="text-right hidden sm:block">
              <div class="text-sm">{{ me()?.user?.fullName ?? '…' }}</div>
              <div class="text-xs text-mut">{{ me()?.user?.email ?? '' }}</div>
            </div>
            <div class="avatar">{{ initials() }}</div>
          </div>
        </header>

        <nav
          class="md:hidden flex items-center gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-1"
        >
          <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" class="pill">
            Inicio
          </a>
          <a routerLink="/products" routerLinkActive="is-active" class="pill">
            Productos
          </a>
          <a routerLink="/trace" routerLinkActive="is-active" class="pill">
            Trazabilidad
          </a>
          <a routerLink="/notices" routerLinkActive="is-active" class="pill">
            Avisos
          </a>
          <a routerLink="/guide" routerLinkActive="is-active" class="pill">
            Guía
          </a>
        </nav>

        <main class="flex-1 overflow-auto p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .brand {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      line-height: 1.2;
    }
    .brand-sub {
      font-size: 0.72rem;
      color: var(--color-mut);
      margin-top: 0.15rem;
    }
    .nav-group {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-mut);
      padding: 0 0.75rem;
      margin-bottom: 0.3rem;
    }
    .nav-item {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      color: var(--color-mut);
      text-decoration: none;
      border-left: 2px solid transparent;
    }
    .nav-item:hover {
      background: var(--color-surface-2);
      color: var(--color-ink);
    }
    button.nav-item {
      background: transparent;
      width: 100%;
    }
    .nav-item.is-active {
      background: color-mix(in srgb, var(--color-accent) 9%, transparent);
      color: var(--color-accent);
      border-left-color: var(--color-accent);
      font-weight: 600;
    }
    .header-link {
      font-size: 0.8rem;
      color: var(--color-mut);
      text-decoration: none;
    }
    .header-link:hover {
      color: var(--color-accent);
    }
    .avatar {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 9999px;
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-2));
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-accent);
    }
    .pill {
      flex: none;
      padding: 0.35rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.78rem;
      color: var(--color-mut);
      text-decoration: none;
    }
    .pill.is-active {
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
      color: var(--color-accent);
      font-weight: 600;
    }
  `,
})
export class Layout implements OnInit {
  readonly auth = inject(Auth);
  private readonly directory = inject(Directory);
  private readonly router = inject(Router);

  private readonly meState = signal<MeResponse | null>(null);
  readonly me = this.meState.asReadonly();
  readonly initials = computed(() => {
    const me = this.meState();
    const name = me?.user?.fullName || me?.user?.email || '';
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  readonly activityNames = computed(() => {
    const activities = this.meState()?.actor?.activities ?? [];
    return activities
      .map((activity) => activityLabel(activity.code, activity.name))
      .join(' · ');
  });

  ngOnInit(): void {
    this.auth
      .me()
      .then((me) => {
        this.meState.set(me);
        if (me.actor) {
          void this.directory.get(me.actor.id);
          if (
            me.actor.activities.length === 0 &&
            me.user.roles.includes('owner')
          ) {
            void this.router.navigate(['/onboarding'], { replaceUrl: true });
          }
        }
      })
      .catch(() => {
        this.auth.logout();
      });
  }
}
