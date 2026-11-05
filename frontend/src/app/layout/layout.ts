import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth.service';
import { Directory } from '../core/directory.service';
import type { MeResponse } from '../core/models';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen flex">
      <aside class="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
        <div class="px-5 py-5 border-b border-border">
          <div class="text-lg font-semibold tracking-tight">NodooTrace</div>
          <div class="text-xs text-mut mt-0.5">Trazabilidad digital de productos</div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Inicio</a>
          <a routerLink="/products" routerLinkActive="active">Productos</a>
          <a routerLink="/trace" routerLinkActive="active">Trazabilidad</a>
          <a routerLink="/notices" routerLinkActive="active">Avisos</a>
        </nav>
        <div class="px-3 py-4 border-t border-border">
          <a (click)="auth.logout()" class="block w-full text-left nav-item">Cerrar sesión</a>
        </div>
      </aside>

      <div class="flex-1 flex flex-col min-w-0">
        <header class="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between px-6">
          <div class="text-sm text-mut truncate">
            {{ me()?.actor?.name ?? 'Tu organización' }}
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <div class="text-sm">{{ me()?.user?.fullName ?? '…' }}</div>
              <div class="text-xs text-mut">{{ me()?.user?.email ?? '' }}</div>
            </div>
            <div class="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center text-sm font-medium">
              {{ initials() }}
            </div>
          </div>
        </header>
        <main class="flex-1 overflow-auto p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    .nav-item {
      display: block;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      color: var(--color-mut);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .nav-item:hover {
      background: var(--color-surface-2);
      color: var(--color-ink);
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

  ngOnInit(): void {
    this.auth.me().then((me) => {
      this.meState.set(me);
      if (me.actor) {
        void this.directory.get(me.actor.id);
      }
    }).catch(() => {
      this.auth.logout();
    });
  }
}
