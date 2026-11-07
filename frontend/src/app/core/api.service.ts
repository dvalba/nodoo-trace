import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type {
  ActivityType,
  ActorRef,
  Batch,
  CreateNoticePayload,
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

  listActivityTypes(): Promise<ActivityType[]> {
    return this.req(this.http.get<ActivityType[]>(`${BASE}/activity-types`));
  }

  listProducts(): Promise<Product[]> {
    return this.req(this.http.get<Product[]>(`${BASE}/products`));
  }

  createProduct(payload: { sku: string; name: string }): Promise<Product> {
    return this.req(this.http.post<Product>(`${BASE}/products`, payload));
  }

  createBatch(
    productId: string,
    payload: { batchCode: string },
  ): Promise<Batch> {
    return this.req(
      this.http.post<Batch>(`${BASE}/products/${productId}/batches`, payload),
    );
  }

  commissionEpc(payload: {
    productId: string;
    batchId?: string;
  }): Promise<Epc> {
    return this.req(this.http.post<Epc>(`${BASE}/epcs`, payload));
  }

  shipEpc(epcId: string): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(`${BASE}/epcs/${encodeURIComponent(epcId)}/ship`, {}),
    );
  }

  receiveEpc(epcId: string): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/receive`,
        {},
      ),
    );
  }

  invoiceEpc(
    epcId: string,
    payload: { bizTransactionId: string; ownershipTransferTo?: string },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/invoice`,
        payload,
      ),
    );
  }

  listEpcs(): Promise<Epc[]> {
    return this.req(this.http.get<Epc[]>(`${BASE}/epcs`));
  }

  createNotice(
    productId: string,
    payload: CreateNoticePayload,
  ): Promise<Notice> {
    return this.req(
      this.http.post<Notice>(
        `${BASE}/products/${productId}/notices`,
        payload,
      ),
    );
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
