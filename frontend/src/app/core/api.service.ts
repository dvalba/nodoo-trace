import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type {
  ActorRef,
  Batch,
  Epc,
  EpcHistoryEntry,
  MeResponse,
  Notice,
  NoticeAck,
  Product,
} from './models';

const BASE = '/api/v1';

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  me(): Promise<MeResponse> {
    return this.req(this.http.get<MeResponse>(`${BASE}/auth/me`));
  }

  listProducts(): Promise<Product[]> {
    return this.req(this.http.get<Product[]>(`${BASE}/products`));
  }

  listBatches(productId: string): Promise<Batch[]> {
    return this.req(this.http.get<Batch[]>(`${BASE}/products/${productId}/batches`));
  }

  getEpc(epcId: string): Promise<Epc> {
    return this.req(this.http.get<Epc>(`${BASE}/epcs/${encodeURIComponent(epcId)}`));
  }

  getHistory(epcId: string): Promise<EpcHistoryEntry[]> {
    return this.req(this.http.get<EpcHistoryEntry[]>(`${BASE}/epcs/${encodeURIComponent(epcId)}/history`));
  }

  listNotices(productId: string): Promise<Notice[]> {
    return this.req(this.http.get<Notice[]>(`${BASE}/products/${productId}/notices`));
  }

  getNotice(noticeId: string): Promise<Notice> {
    return this.req(this.http.get<Notice>(`${BASE}/notices/${noticeId}`));
  }

  ackNotice(noticeId: string): Promise<NoticeAck> {
    return this.req(this.http.post<NoticeAck>(`${BASE}/notices/${noticeId}/ack`, {}));
  }

  listAcks(noticeId: string): Promise<NoticeAck[]> {
    return this.req(this.http.get<NoticeAck[]>(`${BASE}/notices/${noticeId}/acks`));
  }

  getActor(actorId: string): Promise<ActorRef> {
    return this.req(this.http.get<ActorRef>(`${BASE}/actor/${actorId}`));
  }

  private req<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(obs);
  }
}
