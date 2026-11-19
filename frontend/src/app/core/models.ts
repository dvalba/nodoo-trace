export type PlatformRole = 'user' | 'staff';

export type UserRole = 'owner' | 'member' | 'viewer' | 'admin';

export type UserStatus =
  | 'email_unverified'
  | 'awaiting_approval'
  | 'active'
  | 'suspended'
  | 'banned';

export type ActorStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface InvitationPreview {
  inviteId: string;
  actorId: string;
  actorName: string;
  actorStatus: ActorStatus;
  email: string;
  roles: UserRole[];
  expiresAt: string;
  hasAccount: boolean;
  userId?: string;
}

export interface Invitation {
  id: string;
  email: string;
  roles: UserRole[];
  actorName: string;
  actorStatus: ActorStatus;
  status: string;
  expiresAt: string;
  createdAt: string;
  emailSent: boolean;
  invitedBy: { id: string; email: string };
}

export interface InvitationActionResult {
  userId: string;
  email: string;
  created: boolean;
  userStatus: UserStatus;
  actorStatus: ActorStatus;
  message: string;
}

export interface Member {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  status: UserStatus;
  createdAt: string;
}

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

export interface ActivityType {
  code: string;
  name: string;
  description: string | null;
}

export interface RegisterActorPayload {
  legalName: string;
  organizationNumber?: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface Operation {
  code: string;
  label: string;
  group: string;
  sortOrder: number;
}

export interface OperationSuggestion {
  activities: ActivityRef[];
  covered: string[];
  extras: string[];
}

export interface AcceptActivitiesPayload {
  activityCodes: string[];
  operations: string[];
}

export interface AcceptActivitiesResponse {
  actorId: string;
  activities: ActivityRef[];
}

export interface CustomActivityResponse {
  actorId: string;
  activity: ActivityRef;
}

export interface RegisterResponse {
  actor: {
    id: string;
    name: string;
    organizationNumber: string | null;
    status: string;
    activities: ActivityRef[];
  };
  user: AuthUser & { status: string };
  emailSent: boolean;
  message: string;
}

export interface ActorRef {
  id: string;
  name: string;
  activities: ActivityRef[];
  operations?: string[];
}

export interface MeResponse {
  user: AuthUser;
  actor: ActorRef | null;
}

export interface ActorSummary {
  id: string;
  name: string;
}

export interface PendingActor {
  id: string;
  name: string;
  organizationNumber: string | null;
}

export interface ApproveActorResult {
  actorId: string;
  actorStatus: ActorStatus;
  activatedUsers: number;
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
  destinationActorId: string | null;
  status: EpcStatus;
  commissionedAt: string;
}

export interface EpcSearchResult {
  cases: Epc[];
  items: { product: Product; batches: Batch[] }[];
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
  epcs: { id: string; role: EventEpcRole }[];
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

export interface CreateNoticePayload {
  type: NoticeType;
  title: string;
  description?: string;
  batchId?: string;
  epcIds?: string[];
}

export interface NoticeAck {
  id: string;
  noticeId: string;
  actorId: string;
  acknowledgedAt: string;
}
