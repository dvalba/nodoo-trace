import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth.service';
import { OperationsFlow } from '../../components/operations/operations-flow';
import type { MeResponse } from '../../core/models';

@Component({
  selector: 'app-onboarding',
  imports: [OperationsFlow],
  template: `
    <div class="page">
      <header class="topbar">
        <div>
          <div class="brand">NodooTrace</div>
          <div class="brand-sub">Configuración de la organización</div>
        </div>
        <button type="button" class="btn-ghost" (click)="auth.logout()">
          Cerrar sesión
        </button>
      </header>

      <main class="content">
        <ol class="steps">
          <li class="done">
            <span class="num">1</span>
            <span>Cuenta creada</span>
          </li>
          <li class="active">
            <span class="num">2</span>
            <span>Operaciones y actividad</span>
          </li>
          <li>
            <span class="num">3</span>
            <span>Listo para trazar</span>
          </li>
        </ol>

        @if (loading()) {
          <p class="muted">Cargando…</p>
        } @else if (blocked()) {
          <section class="card">
            <h1 class="title">No puedes configurar esta organización</h1>
            <p class="muted mt-2">{{ blocked() }}</p>
            <button type="button" class="btn-primary mt-4" (click)="auth.logout()">
              Volver a iniciar sesión
            </button>
          </section>
        } @else {
          <app-operations-flow [initialOperations]="[]" (saved)="finish()" />
          <p class="hint">
            Esta configuración se realiza una sola vez. Si más adelante necesitas
            cambiarla, contacta al administrador de la plataforma.
          </p>
        }
      </main>
    </div>
  `,
  styles: `
    .page {
      min-height: 100vh;
      background: var(--color-bg);
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
    }
    .brand {
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .brand-sub {
      font-size: 0.75rem;
      color: var(--color-mut);
    }
    .content {
      max-width: 56rem;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
      display: grid;
      gap: 1.25rem;
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 1px 2px rgb(16 24 40 / 0.04);
    }
    .title {
      font-size: 1.15rem;
      font-weight: 650;
      letter-spacing: -0.01em;
    }
    .muted {
      color: var(--color-mut);
      font-size: 0.875rem;
    }
    .hint {
      color: var(--color-mut);
      font-size: 0.78rem;
    }
    .steps {
      display: flex;
      gap: 0.75rem;
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .steps li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      font-size: 0.78rem;
      color: var(--color-mut);
    }
    .steps .num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 9999px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      font-weight: 700;
      flex: none;
    }
    .steps li.done .num {
      background: var(--color-success);
      border-color: var(--color-success);
      color: #0b0f17;
    }
    .steps li.active .num {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-accent-ink);
    }
    .steps li.active,
    .steps li.done {
      color: var(--color-ink);
    }
    .btn-primary,
    .btn-ghost {
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      padding: 0.55rem 0.9rem;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .btn-primary {
      background: var(--color-accent);
      color: var(--color-accent-ink);
    }
    .btn-primary:hover {
      background: color-mix(in srgb, var(--color-accent) 88%, #000);
    }
    .btn-ghost {
      background: transparent;
      color: var(--color-mut);
    }
    .btn-ghost:hover {
      color: var(--color-ink);
      background: var(--color-surface-2);
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .mt-2 {
      margin-top: 0.5rem;
    }
    .mt-4 {
      margin-top: 1rem;
    }
  `,
})
export class Onboarding implements OnInit {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly blocked = signal<string | null>(null);

  ngOnInit(): void {
    this.auth
      .refreshMe()
      .then((me) => this.prepare(me))
      .catch(() => {
        this.blocked.set('No pudimos cargar tu cuenta. Vuelve a iniciar sesión.');
        this.loading.set(false);
      });
  }

  private prepare(me: MeResponse): void {
    if (!me.actor) {
      this.blocked.set('Tu cuenta no está vinculada a una organización.');
      this.loading.set(false);
      return;
    }
    if ((me.actor.activities ?? []).length > 0) {
      void this.router.navigate(['/'], { replaceUrl: true });
      return;
    }
    if (!me.user.roles.includes('owner')) {
      this.blocked.set(
        'Solo el propietario de la organización puede completar esta configuración.',
      );
      this.loading.set(false);
      return;
    }

    this.loading.set(false);
  }

  finish(): void {
    void this.router.navigate(['/'], {
      queryParams: { onboarded: '1' },
      replaceUrl: true,
    });
  }
}
