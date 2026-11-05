export type PlatformRole = 'user' | 'admin';

export type UserRole =
  | 'owner'
  | 'operator'
  | 'viewer'
  | 'approver'
  | 'auditor';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  actorId: string | null;
  platformRoles: PlatformRole[];
  roles: UserRole[];
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ActivityRef {
  code: string;
  name: string;
}

export interface ActorRef {
  id: string;
  name: string;
  activities: ActivityRef[];
}

export interface MeResponse {
  user: AuthUser;
  actor: ActorRef | null;
}

export interface Product {
  id: string;
  createdByActorId: string;
  sku: string;
  name: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  productId: string;
  product: Product;
  batchCode: string;
  createdAt: string;
}

export type EpcStatus =
  | 'active'
  | 'in_transit'
  | 'in_progress'
  | 'consumed'
  | 'damaged'
  | 'expired';

export interface Epc {
  id: string;
  productId: string;
  product: Product | null;
  batchId: string | null;
  batch: Batch | null;
  parentId: string | null;
  producerActorId: string;
  ownerActorId: string | null;
  custodianActorId: string | null;
  status: EpcStatus;
  commissionedAt: string;
}

export type EventEpcRole =
  | 'observed'
  | 'parent'
  | 'child'
  | 'input'
  | 'output'
  | 'source'
  | 'associated';

export type EventType =
  | 'ObjectEvent'
  | 'AggregationEvent'
  | 'TransactionEvent'
  | 'TransformationEvent'
  | 'AssociationEvent';

export type BizStep =
  | 'commissioning'
  | 'receiving'
  | 'shipping'
  | 'packing'
  | 'unpacking'
  | 'transforming'
  | 'inspecting';

export type BizTransactionType = 'po' | 'inv' | 'desadv' | 'bol';

export interface EpcHistoryEntry {
  role: EventEpcRole;
  id: string;
  type: EventType;
  eventTime: string;
  recordedAt: string;
  actorId: string;
  batchId: string | null;
  readPointId: string | null;
  bizStep: BizStep | null;
  bizTransactionType: BizTransactionType | null;
  bizTransactionId: string | null;
  disposition: EpcStatus | null;
  source: string;
  eventUid: string | null;
  payload: Record<string, unknown>;
}

export type NoticeType = 'recall' | 'advisory';

export interface NoticeEpcLink {
  noticeId: string;
  epcId: string;
}

export interface Notice {
  id: string;
  productId: string;
  product: Product | null;
  batchId: string | null;
  type: NoticeType;
  title: string;
  description: string | null;
  createdByActorId: string;
  createdAt: string;
  epcs: NoticeEpcLink[];
}

export interface NoticeAck {
  id: string;
  noticeId: string;
  actorId: string;
  acknowledgedAt: string;
}
