import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { OperationsFlow } from '../../components/operations/operations-flow';
import { Auth } from '../../core/auth.service';
import { activityLabel } from '../../core/labels';

@Component({
  selector: 'app-organization',
  imports: [OperationsFlow],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Organización</h1>
        <p class="text-sm text-mut mt-1">
          Define las operaciones y la clasificación de actividad de
          {{ me()?.actor?.name ?? 'tu organización' }}. Esto determina qué
          eventos puede emitir en la cadena.
        </p>
      </div>

      @if (loading()) {
        <p class="text-sm text-mut">Cargando…</p>
      } @else if (!canManage()) {
        <div class="card">
          <h2 class="text-sm font-semibold">Solo el propietario</h2>
          <p class="text-sm text-mut mt-1">
            Solo el propietario de la organización puede cambiar las
            operaciones y la clasificación de actividad.
          </p>
        </div>
      } @else {
        <div class="space-y-3">
          @if (currentActivities().length > 0) {
            <div class="card">
              <h2 class="text-sm font-semibold mb-2">Actividad actual</h2>
              <div class="flex flex-wrap gap-2">
                @for (activity of currentActivities(); track activity.code) {
                  <span class="chip-activity">
                    {{ activityLabel(activity.code, activity.name) }}
                  </span>
                }
              </div>
            </div>
          }
          <app-operations-flow
            [initialOperations]="initialOperations()"
            (saved)="onSaved()"
          />
        </div>
      }
    </div>
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    .chip-activity {
      display: inline-flex;
      padding: 0.2rem 0.55rem;
      border-radius: 0.4rem;
      background: color-mix(in srgb, var(--color-accent) 9%, var(--color-surface-2));
      border: 1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border));
      font-size: 0.78rem;
      font-weight: 600;
    }
  `,
})
export class Organization implements OnInit {
  private readonly auth = inject(Auth);

  readonly loading = signal(true);
  readonly me = this.auth.me;
  readonly initialOperations = signal<string[]>([]);

  readonly canManage = computed(
    () => this.me()?.user.roles.includes('owner') ?? false,
  );
  readonly currentActivities = computed(
    () => this.me()?.actor?.activities ?? [],
  );

  ngOnInit(): void {
    this.auth
      .refreshMe()
      .then((me) => {
        this.initialOperations.set(me.actor?.operations ?? []);
      })
      .catch(() => {
        this.auth.logout();
      })
      .finally(() => this.loading.set(false));
  }

  activityLabel(code: string, name?: string): string {
    return activityLabel(code, name);
  }

  onSaved(): void {
    void this.auth.refreshMe();
  }
}
