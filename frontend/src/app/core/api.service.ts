import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type {
  AcceptActivitiesPayload,
  AcceptActivitiesResponse,
  ActivityType,
  ActorRef,
  ActorSummary,
  ApproveActorResult,
  Batch,
  CreateNoticePayload,
  CustomActivityResponse,
  Epc,
  EpcHistoryEntry,
  EpcSearchResult,
  Invitation,
  InvitationActionResult,
  InvitationPreview,
  MeResponse,
  Member,
  Notice,
  NoticeAck,
  Operation,
  OperationSuggestion,
  PendingActor,
  Product,
  UserRole,
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

  listOperations(): Promise<Operation[]> {
    return this.req(this.http.get<Operation[]>(`${BASE}/actor/operations`));
  }

  suggestOperations(operations: string[]): Promise<OperationSuggestion[]> {
    return this.req(
      this.http.post<OperationSuggestion[]>(
        `${BASE}/actor/operations/suggestions`,
        { operations },
      ),
    );
  }

  acceptActivities(
    payload: AcceptActivitiesPayload,
  ): Promise<AcceptActivitiesResponse> {
    return this.req(
      this.http.post<AcceptActivitiesResponse>(
        `${BASE}/actor/operations/accept`,
        payload,
      ),
    );
  }

  createCustomActivity(payload: {
    name: string;
    operations: string[];
  }): Promise<CustomActivityResponse> {
    return this.req(
      this.http.post<CustomActivityResponse>(
        `${BASE}/actor/operations/custom`,
        payload,
      ),
    );
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

  shipEpc(epcId: string, payload: { destinationActorId: string }): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/ship`,
        payload,
      ),
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

  purchaseOrderEpc(
    epcId: string,
    payload: { bizTransactionId: string },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/purchase-order`,
        payload,
      ),
    );
  }

  despatchAdviceEpc(
    epcId: string,
    payload: { bizTransactionId: string },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/despatch-advice`,
        payload,
      ),
    );
  }

  billOfLadingEpc(
    epcId: string,
    payload: { bizTransactionId: string },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/bill-of-lading`,
        payload,
      ),
    );
  }

  inspectEpc(
    epcId: string,
    payload: { result: 'passed' | 'failed' },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/inspect`,
        payload,
      ),
    );
  }

  aggregateEpc(
    epcId: string,
    payload: { childEpcs: string[] },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/aggregate`,
        payload,
      ),
    );
  }

  disaggregateEpc(
    epcId: string,
    payload: { childEpcs: string[] },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/disaggregate`,
        payload,
      ),
    );
  }

  packEpc(epcId: string, payload: { childEpcs: string[] }): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/pack`,
        payload,
      ),
    );
  }

  unpackEpc(epcId: string, payload: { childEpcs: string[] }): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/unpack`,
        payload,
      ),
    );
  }

  associateEpc(
    epcId: string,
    payload: { relatedEpcs: string[] },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/associate`,
        payload,
      ),
    );
  }

  disassociateEpc(
    epcId: string,
    payload: { relatedEpcs: string[] },
  ): Promise<Epc> {
    return this.req(
      this.http.post<Epc>(
        `${BASE}/epcs/${encodeURIComponent(epcId)}/disassociate`,
        payload,
      ),
    );
  }

  searchEpcs(q: string): Promise<EpcSearchResult> {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.req(
      this.http.get<EpcSearchResult>(`${BASE}/epcs/search${query}`),
    );
  }

  listEpcs(params?: { q?: string; productId?: string; batchId?: string }) {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.productId) search.set('productId', params.productId);
    if (params?.batchId) search.set('batchId', params.batchId);
    const query = search.toString();
    return this.req(
      this.http.get<Epc[]>(`${BASE}/epcs${query ? `?${query}` : ''}`),
    );
  }

  previewInvitation(token: string): Promise<InvitationPreview> {
    return this.req(
      this.http.get<InvitationPreview>(
        `${BASE}/invitations/${encodeURIComponent(token)}/preview`,
      ),
    );
  }

  acceptInvitation(payload: {
    inviteToken: string;
    fullName: string;
    password: string;
  }): Promise<InvitationActionResult> {
    return this.req(
      this.http.post<InvitationActionResult>(
        `${BASE}/invitations/accept`,
        payload,
      ),
    );
  }

  verifyEmailToken(token: string): Promise<InvitationActionResult> {
    return this.req(
      this.http.post<InvitationActionResult>(`${BASE}/invitations/verify`, {
        token,
      }),
    );
  }

  resendVerification(email: string): Promise<{
    email: string;
    emailSent: boolean;
    message: string;
  }> {
    return this.req(
      this.http.post<{ email: string; emailSent: boolean; message: string }>(
        `${BASE}/auth/verification/resend`,
        { email },
      ),
    );
  }

  listMembers(): Promise<Member[]> {
    return this.req(this.http.get<Member[]>(`${BASE}/users`));
  }

  inviteMember(payload: { email: string; roles: UserRole[] }): Promise<Invitation> {
    return this.req(this.http.post<Invitation>(`${BASE}/invitations`, payload));
  }

  addMemberRoles(userId: string, roles: UserRole[]): Promise<Member> {
    return this.req(
      this.http.patch<Member>(`${BASE}/users/${userId}`, { roles }),
    );
  }

  removeMember(userId: string): Promise<{ deleted: boolean; userId: string }> {
    return this.req(
      this.http.delete<{ deleted: boolean; userId: string }>(
        `${BASE}/users/${userId}`,
      ),
    );
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
    return this.req(this.http.get<ActorRef>(`${BASE}/actors/${actorId}`));
  }

  listActors(): Promise<ActorSummary[]> {
    return this.req(this.http.get<ActorSummary[]>(`${BASE}/actors`));
  }

  listPendingActors(): Promise<PendingActor[]> {
    return this.req(
      this.http.get<PendingActor[]>(`${BASE}/admin/actors/pending`),
    );
  }

  approveActor(actorId: string): Promise<ApproveActorResult> {
    return this.req(
      this.http.patch<ApproveActorResult>(
        `${BASE}/admin/actors/${encodeURIComponent(actorId)}/approval`,
        {},
      ),
    );
  }

  private req<T>(obs: Observable<T>): Promise<T> {
    return firstValueFrom(obs);
  }
}
