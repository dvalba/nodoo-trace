import { createHash } from 'node:crypto';
import { BizStep } from './epics-core/enums/biz-step.enum.js';
import { EpcStatus } from './epics-core/enums/epc-status.enum.js';
import { EventAction } from './epics-core/enums/event-action.enum.js';
import { EventType } from './epics-core/enums/event-type.enum.js';
import { EventEpcRole } from './enums/event-epc-role.enum.js';
import type { TwinMutation } from './twin-projector.js';

/**
 * Parser/validator of third-party EPCIS 2.0 capture documents (US15,
 * FR-2001..FR-2005). The document arrives unmodified from the third party;
 * only the fields that exist in the local model are normalized, and the
 * rest (unknown bizStep values, vendor extensions, sensor reports, …) is
 * preserved verbatim in the event payload.
 */
export class EpcisParseError extends Error {}

export interface ParsedEpcLink {
  id: string;
  role: EventEpcRole;
}

export interface ParsedEpcEvent {
  type: EventType;
  /** The document `eventID`, or a deterministic digest when it is absent. */
  eventUid: string;
  eventTime: Date;
  action: EventAction | null;
  /** Local `BizStep` when the document value is in the local enum, else null. */
  bizStep: BizStep | null;
  bizTransactionType: string | null;
  bizTransactionId: string | null;
  readPointId: string | null;
  /** Local `EpcStatus` when the document value is in the local enum, else null. */
  disposition: EpcStatus | null;
  links: ParsedEpcLink[];
  /** The original event object, stored as-is in the ledger payload. */
  raw: Record<string, unknown>;
}

export interface ParsedEpcisDocument {
  events: ParsedEpcEvent[];
}

export interface EpcOwnerMapping {
  ownerActorId: string;
  productId: string;
}

export interface EpcisRequest {
  document: unknown;
  epcMapping: Record<string, EpcOwnerMapping> | null;
}

const EVENT_TYPES = new Set<string>(Object.values(EventType));
const ACTIONS = new Set<string>(Object.values(EventAction));
const BIZ_STEPS = new Set<string>(Object.values(BizStep));
const DISPOSITIONS = new Set<string>(Object.values(EpcStatus));

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new EpcisParseError(message);
}

/** Human-readable representation for error messages. */
function describeValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function eventLabel(index: number, type: unknown): string {
  return `Event #${index + 1}${typeof type === 'string' ? ` (${type})` : ''}`;
}

function epcArray(
  value: unknown,
  index: number,
  type: string,
  field: string,
): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${eventLabel(index, type)} requires a non-empty ${field} list.`);
  }
  for (const epc of value) {
    if (typeof epc !== 'string' || epc.length === 0) {
      fail(`${eventLabel(index, type)} has a non-string entry in ${field}.`);
    }
  }
  return value as string[];
}

/**
 * Stable serialization (sorted object keys, arrays kept in order) used to
 * derive a deterministic event uid for events that carry no `eventID`, so a
 * re-pushed document still dedupes (FR-2002).
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

export function derivedEventUid(event: Record<string, unknown>): string {
  const digest = createHash('sha256')
    .update(canonicalStringify(event))
    .digest('hex');
  return `urn:nodoo:ingest:${digest}`;
}

function parseEventTime(value: unknown, index: number, type: string): Date {
  if (typeof value !== 'string') {
    fail(`${eventLabel(index, type)} requires an eventTime.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    fail(`${eventLabel(index, type)} has an invalid eventTime: ${value}.`);
  }
  return parsed;
}

function parseAction(
  value: unknown,
  index: number,
  type: string,
): EventAction | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !ACTIONS.has(value)) {
    fail(
      `${eventLabel(index, type)} has an invalid action: ${describeValue(value)}.`,
    );
  }
  return value as EventAction;
}

function extractLinks(
  type: string,
  raw: Record<string, unknown>,
  index: number,
): ParsedEpcLink[] {
  const links: ParsedEpcLink[] = [];

  if (type === EventType.OBJECT || type === EventType.TRANSACTION) {
    for (const id of epcArray(raw.epcList, index, type, 'epcList')) {
      links.push({ id, role: EventEpcRole.OBSERVED });
    }
    return links;
  }

  if (type === EventType.AGGREGATION || type === EventType.ASSOCIATION) {
    if (typeof raw.parentID !== 'string' || raw.parentID.length === 0) {
      fail(`${eventLabel(index, type)} requires a parentID.`);
    }
    links.push({ id: raw.parentID, role: EventEpcRole.PARENT });
    if (raw.childEPCs !== undefined) {
      for (const id of epcArray(raw.childEPCs, index, type, 'childEPCs')) {
        links.push({ id, role: EventEpcRole.CHILD });
      }
    }
    return links;
  }

  // TransformationEvent: inputs are optional, outputs are required.
  if (raw.inputEPCList !== undefined) {
    for (const id of epcArray(raw.inputEPCList, index, type, 'inputEPCList')) {
      links.push({ id, role: EventEpcRole.INPUT });
    }
  }
  for (const id of epcArray(raw.outputEPCList, index, type, 'outputEPCList')) {
    links.push({ id, role: EventEpcRole.OUTPUT });
  }
  return links;
}

function parseBizTransaction(
  raw: Record<string, unknown>,
): { type: string | null; id: string | null } {
  const list = raw.bizTransactionList;
  if (!Array.isArray(list) || list.length === 0 || !isPlainObject(list[0])) {
    return { type: null, id: null };
  }
  const first = list[0];
  return {
    type:
      typeof first.type === 'string' && first.type.length > 0
        ? first.type
        : null,
    id:
      typeof first.bizTransaction === 'string' && first.bizTransaction.length > 0
        ? first.bizTransaction
        : null,
  };
}

function parseEvent(
  raw: unknown,
  index: number,
): ParsedEpcEvent {
  if (!isPlainObject(raw)) {
    fail(`Event #${index + 1} must be an object.`);
  }

  const type = raw.type;
  if (typeof type !== 'string' || !EVENT_TYPES.has(type)) {
    fail(`Event #${index + 1} has an unknown type: ${String(type)}.`);
  }

  const eventTime = parseEventTime(raw.eventTime, index, type);
  const action = parseAction(raw.action, index, type);
  const links = extractLinks(type, raw, index);

  if (links.length === 0) {
    fail(`${eventLabel(index, type)} must reference at least one EPC.`);
  }

  const bizStep =
    typeof raw.bizStep === 'string' && BIZ_STEPS.has(raw.bizStep)
      ? (raw.bizStep as BizStep)
      : null;
  const disposition =
    typeof raw.disposition === 'string' && DISPOSITIONS.has(raw.disposition)
      ? (raw.disposition as EpcStatus)
      : null;
  const { type: bizTransactionType, id: bizTransactionId } =
    parseBizTransaction(raw);
  const readPointId =
    isPlainObject(raw.readPoint) && typeof raw.readPoint.id === 'string'
      ? raw.readPoint.id
      : null;
  const eventUid =
    typeof raw.eventID === 'string' && raw.eventID.length > 0
      ? raw.eventID
      : derivedEventUid(raw);

  return {
    type: type as EventType,
    eventUid,
    eventTime,
    action,
    bizStep,
    bizTransactionType,
    bizTransactionId,
    readPointId,
    disposition,
    links,
    raw,
  };
}

/**
 * Parses and validates an EPCIS 2.0 capture document. Throws
 * `EpcisParseError` (→ 400, no partial effects) when the document is not a
 * valid EPCIS 2.0 capture document.
 */
export function parseEpcisDocument(
  raw: unknown,
): ParsedEpcisDocument {
  if (!isPlainObject(raw)) {
    fail('The document must be a JSON object.');
  }
  if (raw.type !== 'EPCISDocument') {
    fail('The document type must be "EPCISDocument".');
  }
  if (raw.schemaVersion !== '2.0') {
    fail(
      `Only EPCIS schema version "2.0" is accepted, got: ${String(
        raw.schemaVersion,
      )}.`,
    );
  }
  const body = raw.epcisBody;
  if (!isPlainObject(body) || !Array.isArray(body.eventList)) {
    fail('The document must carry an epcisBody with an eventList array.');
  }
  if (body.eventList.length === 0) {
    fail('The document eventList must not be empty.');
  }

  const events = body.eventList.map((event, index) => parseEvent(event, index));

  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.eventUid)) {
      fail(`Duplicate eventID in the document: ${event.eventUid}`);
    }
    seen.add(event.eventUid);
  }

  return { events };
}

/**
 * Splits the capture request body. Two shapes are accepted so a real
 * document can be pushed verbatim:
 *
 * - raw: the body IS the EPCIS document (all referenced EPCs must already
 *   be commissioned, otherwise FR-2005 rejects it with 400).
 * - wrapper: `{ document, epcMapping }` where `epcMapping` carries
 *   `{ ownerActorId, productId }` for each uncommissioned EPC (FR-2005).
 */
export function splitRequestBody(body: unknown): EpcisRequest {
  if (!isPlainObject(body)) {
    fail('The request body must be a JSON object.');
  }

  if (isPlainObject(body.document)) {
    const mappingRaw = body.epcMapping;
    let mapping: Record<string, EpcOwnerMapping> | null = null;

    if (mappingRaw !== undefined) {
      if (!isPlainObject(mappingRaw)) {
        fail('epcMapping must be an object keyed by EPC id.');
      }
      mapping = {};
      for (const [epc, entry] of Object.entries(mappingRaw)) {
        if (
          !isPlainObject(entry) ||
          typeof entry.ownerActorId !== 'string' ||
          entry.ownerActorId.length === 0 ||
          typeof entry.productId !== 'string' ||
          entry.productId.length === 0
        ) {
          fail(
            `epcMapping["${epc}"] must be { ownerActorId, productId } with non-empty strings.`,
          );
        }
        mapping[epc] = {
          ownerActorId: entry.ownerActorId,
          productId: entry.productId,
        };
      }
    }

    return { document: body.document, epcMapping: mapping };
  }

  return { document: body, epcMapping: null };
}

/**
 * FR-2004: external events project on the twin with the same rules as local
 * ones, but an EPC that already exists (previously commissioned or created
 * in this very import per FR-2005) is never re-created: the twin of an
 * existing EPC is only updated.
 */
export function dropCreateMutationsForExisting(
  mutations: TwinMutation[],
  existingIds: Set<string>,
): TwinMutation[] {
  return mutations.filter(
    (mutation) => !(mutation.create && existingIds.has(mutation.id)),
  );
}
