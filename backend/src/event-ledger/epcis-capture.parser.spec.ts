import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EpcisParseError,
  canonicalStringify,
  derivedEventUid,
  dropCreateMutationsForExisting,
  parseEpcisDocument,
  splitRequestBody,
} from './epcis-capture.parser.js';

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../test/fixtures/epcis/${name}`, import.meta.url),
      ),
      'utf8',
    ),
  );

describe('epcis-capture parser (real EPCIS 2.0 documents, unmodified)', () => {
  it('parses ObjectEvent.json: 2 events with their eventIDs as uids', () => {
    const doc = parseEpcisDocument(fixture('ObjectEvent.json'));
    expect(doc.events).toHaveLength(2);

    const [first, second] = doc.events;
    expect(first.type).toBe('ObjectEvent');
    expect(first.eventUid).toBe(
      'ni:///sha-256;df7bb3c352fef055578554f09f5e2aa41782150ced7bd0b8af24dd3ccb30ba69?ver=CBV2.0',
    );
    expect(first.bizStep).toBe('shipping');
    expect(first.disposition).toBe('in_transit');
    expect(first.action).toBe('OBSERVE');
    expect(first.bizTransactionType).toBe('po');
    expect(first.bizTransactionId).toBe(
      'http://transaction.acme.com/po/12345678',
    );
    expect(first.links).toEqual([
      { id: 'urn:epc:id:sgtin:0614141.107346.2017', role: 'observed' },
      { id: 'urn:epc:id:sgtin:0614141.107346.2018', role: 'observed' },
    ]);
    // The vendor extension survives verbatim in the raw payload.
    expect(second.raw['example:myField']).toBe(
      'Example of a vendor/user extension',
    );
    expect(second.bizStep).toBe('receiving');
    expect(second.links).toHaveLength(1);
  });

  it('parses AggregationEvent.json: parent + children', () => {
    const doc = parseEpcisDocument(fixture('AggregationEvent.json'));
    expect(doc.events).toHaveLength(1);
    const event = doc.events[0];
    expect(event.type).toBe('AggregationEvent');
    expect(event.bizStep).toBe('receiving');
    expect(event.links).toEqual([
      { id: 'urn:epc:id:sscc:0614141.1234567890', role: 'parent' },
      { id: 'urn:epc:id:sgtin:0614141.107346.2017', role: 'child' },
      { id: 'urn:epc:id:sgtin:0614141.107346.2018', role: 'child' },
    ]);
  });

  it('parses TransformationEvent.json: inputs + outputs', () => {
    const doc = parseEpcisDocument(fixture('TransformationEvent.json'));
    expect(doc.events).toHaveLength(1);
    const event = doc.events[0];
    expect(event.type).toBe('TransformationEvent');
    expect(event.bizStep).toBe('commissioning');
    const roles = event.links.map((link) => link.role);
    expect(roles.filter((role) => role === 'input')).toHaveLength(2);
    expect(roles.filter((role) => role === 'output')).toHaveLength(4);
    // ilmd and vendor extensions survive verbatim.
    expect(event.raw.ilmd).toEqual({
      'example:bestBeforeDate': '2014-12-10',
      'example:batch': 'XYZ',
    });
  });

  it('parses AssociationEvent.json: no eventID -> deterministic derived uids, unknown bizSteps -> null', () => {
    const doc = parseEpcisDocument(fixture('AssociationEvent.json'));
    expect(doc.events).toHaveLength(2);
    for (const event of doc.events) {
      expect(event.eventUid).toMatch(/^urn:nodoo:ingest:[0-9a-f]{64}$/);
      // "assembling"/"installing" are not local BizSteps.
      expect(event.bizStep).toBeNull();
      expect(event.links[0].role).toBe('parent');
    }
    expect(doc.events[0].links).toHaveLength(2); // parent + 1 child
    expect(doc.events[1].links).toHaveLength(3); // parent + 2 children
    // The second event carries a local biz transaction type.
    expect(doc.events[1].bizTransactionType).toBe('inv');
    expect(doc.events[1].bizTransactionId).toBe(
      'urn:epcglobal:cbv:bt:4023333000000:54545',
    );
  });

  it('parses TransactionEvent.json: no eventID, bizStep outside the local enum, type-less bizTransaction', () => {
    const doc = parseEpcisDocument(fixture('TransactionEvent.json'));
    expect(doc.events).toHaveLength(2);
    const [first, second] = doc.events;
    for (const event of doc.events) {
      expect(event.eventUid).toMatch(/^urn:nodoo:ingest:[0-9a-f]{64}$/);
    }
    // First event: full-URL bizStep (not local) and a bizTransaction without type.
    expect(first.bizStep).toBeNull();
    expect(first.bizTransactionType).toBeNull();
    expect(first.bizTransactionId).toBe(
      'urn:epc:id:gdti:95252084.0001.0003555480001000',
    );
    // Second event: non-local biz transaction type (a 33-char URI) and
    // non-local bizStep, with a local disposition value.
    expect(second.bizStep).toBeNull();
    expect(second.bizTransactionType).toBe(
      'urn:gs1:epcisapp:rail:btt:passage',
    );
    expect(second.disposition).toBe('in_transit');
    // rail:* vendor extensions survive verbatim.
    expect(second.raw['rail:trainAxleCount']).toBe('12');
  });

  it('parses Combination_of_different_event.json: 6 mixed events, some without eventID', () => {
    const doc = parseEpcisDocument(fixture('Combination_of_different_event.json'));
    expect(doc.events).toHaveLength(6);
    expect(doc.events.map((event) => event.type)).toEqual([
      'ObjectEvent',
      'AggregationEvent',
      'TransactionEvent',
      'TransformationEvent',
      'AssociationEvent',
      'AssociationEvent',
    ]);
    // The sensor-reporting bizStep (full CBV URL) is not a local BizStep.
    expect(doc.events[0].bizStep).toBeNull();
    // An AssociationEvent may carry only a parentID (no childEPCs).
    expect(doc.events[4].links).toEqual([
      { id: 'urn:epc:id:grai:4012345.55555.987', role: 'parent' },
    ]);
    // The last event carries an explicit eventID.
    expect(doc.events[5].eventUid).toBe(
      'urn:uuid:fd338495-0e6d-41dd-afee-a862ecd32518',
    );
    // HTTPS EPC identifiers are accepted (EPCs can be any URI).
    expect(doc.events[0].links[0].id).toBe(
      'https://id.example.com/8003/030013450007718765',
    );
  });

  it('derives a stable uid for events without eventID (FR-2002 on re-push)', () => {
    const first = parseEpcisDocument(fixture('AssociationEvent.json'));
    const second = parseEpcisDocument(fixture('AssociationEvent.json'));
    expect(second.events.map((e) => e.eventUid)).toEqual(
      first.events.map((e) => e.eventUid),
    );
    expect(first.events[0].eventUid).not.toBe(first.events[1].eventUid);

    const { eventID, ...withoutId } = fixture('ObjectEvent.json').epcisBody
      .eventList[0];
    const withId = derivedEventUid(fixture('ObjectEvent.json').epcisBody
      .eventList[0]);
    expect(withId).not.toBe(derivedEventUid(withoutId));
    expect(eventID).toBeDefined();
  });

  it('canonicalStringify is stable under key order', () => {
    expect(canonicalStringify({ a: 1, b: { d: 2, c: [1, 2] } })).toBe(
      canonicalStringify({ b: { c: [1, 2], d: 2 }, a: 1 }),
    );
    expect(canonicalStringify({ a: 1 })).not.toBe(
      canonicalStringify({ a: 2 }),
    );
  });

  describe('invalid documents (real fixtures, unmodified) -> parse errors', () => {
    it('rejects an invalid schemaVersion', () => {
      expect(() =>
        parseEpcisDocument(fixture('invalid/EPCISDocument_with_invalid_schemaVersion.json')),
      ).toThrowError(EpcisParseError);
      expect(() =>
        parseEpcisDocument(fixture('invalid/EPCISDocument_with_invalid_schemaVersion.json')),
      ).toThrowError(/schema version "2\.0"/);
    });

    it('rejects an invalid action', () => {
      expect(() =>
        parseEpcisDocument(fixture('invalid/ObjectEvent_with_invalid_action.json')),
      ).toThrowError(/invalid action: CREATE/);
    });

    it('rejects an ObjectEvent without identifier list', () => {
      expect(() =>
        parseEpcisDocument(fixture('invalid/ObjectEvent_without_identifier_list.json')),
      ).toThrowError(/non-empty epcList/);
    });
  });

  describe('splitRequestBody', () => {
    const document = fixture('ObjectEvent.json');

    it('accepts the raw document as the whole body', () => {
      const request = splitRequestBody(document);
      expect(request.epcMapping).toBeNull();
      expect(request.document).toBe(document);
    });

    it('accepts a wrapper with epcMapping', () => {
      const request = splitRequestBody({
        document,
        epcMapping: {
          'urn:epc:id:sgtin:0614141.107346.2017': {
            ownerActorId: 'a1',
            productId: 'p1',
          },
        },
      });
      expect(request.document).toBe(document);
      expect(request.epcMapping?.['urn:epc:id:sgtin:0614141.107346.2017']).toEqual({
        ownerActorId: 'a1',
        productId: 'p1',
      });
    });

    it('rejects a malformed epcMapping', () => {
      expect(() =>
        splitRequestBody({
          document,
          epcMapping: { 'urn:x': { ownerActorId: 'a1' } },
        }),
      ).toThrowError(/ownerActorId, productId/);
    });

    it('rejects a non-object body', () => {
      expect(() => splitRequestBody('nope')).toThrowError(
        /request body must be a JSON object/,
      );
    });
  });

  describe('dropCreateMutationsForExisting', () => {
    it('drops create mutations for existing EPCs and keeps the rest', () => {
      const mutations = [
        { id: 'urn:exists', create: true, ownerActorId: 'x' },
        { id: 'urn:exists', create: false, status: 'active' },
        { id: 'urn:new', create: true, productId: 'p' },
      ] as never[];
      const result = dropCreateMutationsForExisting(
        mutations,
        new Set(['urn:exists']),
      );
      expect(result).toHaveLength(2);
      expect(result[0].create).toBe(false);
      expect(result[1].create).toBe(true);
    });
  });
});
