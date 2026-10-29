import { EventType, EventAction, BaseEvent } from '../index.js';

export class AggregationEvent extends BaseEvent {
  type: EventType = EventType.AGGREGATION;
  parentID: string;
  childEPCs: string[];
  action: EventAction.ADD | EventAction.DELETE;
}


// type: AGGREGATION;
  // batchId: string;
  // readPointId: string;
  // actorId: string;
  // parentID: string;
  // childEPCs: string[];
  // action: EventAction.ADD | EventAction.DELETE;
  // eventTime: Date;
//


// type: ASSOCIATION;
//   actorId: string; (Imagino que actorId es quien firma o mete el evento)

//   batchId: string;
//   readPointId: string;


//   epc: string;
//   associatedEPC: string;       

// Estos campos me quedan claro uno es la accion que se realizo, y el otro es el instate de tiempo
//   action: EventAction.ADD | EventAction.DELETE;
//   eventTime: Date;
// }


// type: OBJECT;
//  epcList: string[];
//  bizStep: BizStep;
//  disposition: Disposition;
//  batchId: string;
//  readPointId: string;


//  actorId: string;
//  action: EventAction;
//  eventTime: Date;


//   type: TRANSACTION;
//   epcList: string[];
//   bizTransactionType: BizTransactionType | string;
//   bizTransactionId: string;

//   batchId: string;
//   readPointId: string;
//   actorId: string;
//   eventTime: Date;


//   type: TRANSFORMATION;
//   inputEPCList: string[];
//   outputEPCList: string[];
//   bizStep: TRANSFORMING;

//   batchId: string;
//   readPointId: string;
//   actorId: string;
//   eventTime: Date;
// }
