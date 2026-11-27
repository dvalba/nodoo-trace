import type { Epc } from '../entities/epc.entity.js';

/**
 * The digital twin of an EPC as seen by a given actor (FR-605).
 *
 * The owner reads the whole twin; the current custodian reads it without the
 * producer (no upstream references, FR-D4); the destination of an in-transit
 * case reads only the EPC and its product (FR-D5). Fields that would reveal
 * upstream information are `null` in the scoped views.
 */
export type EpcView = Omit<Epc, 'producerActorId' | 'commissionedAt'> & {
  producerActorId: string | null;
  commissionedAt: Date | null;
};
