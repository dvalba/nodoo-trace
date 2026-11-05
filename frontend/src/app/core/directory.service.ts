import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api.service';
import type { ActorRef } from './models';

@Injectable({ providedIn: 'root' })
export class Directory {
  private readonly api = inject(Api);

  private readonly cache = new Map<string, ActorRef>();
  private readonly inflight = new Map<string, Promise<ActorRef | null>>();
  private readonly version = signal(0);

  get(actorId: string | null): Promise<ActorRef | null> {
    if (!actorId) {
      return Promise.resolve(null);
    }
    const hit = this.cache.get(actorId);
    if (hit) {
      return Promise.resolve(hit);
    }
    const running = this.inflight.get(actorId);
    if (running) {
      return running;
    }
    const promise = this.api
      .getActor(actorId)
      .then((ref) => {
        this.cache.set(actorId, ref);
        this.version.update((v) => v + 1);
        return ref;
      })
      .catch(() => null);
    this.inflight.set(actorId, promise);
    void promise.finally(() => this.inflight.delete(actorId));
    return promise;
  }

  name(actorId: string | null): string {
    this.version();
    if (!actorId) {
      return 'Unknown';
    }
    return this.cache.get(actorId)?.name ?? 'Unknown';
  }
}
