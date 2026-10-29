export const OPERATIONS = [
  {
    code: 'object:commissioning',
    label: 'Create product identities',
    group: 'Sourcing & Production',
    sortOrder: 1,
  },
  {
    code: 'object:packing',
    label: 'Pack products into boxes',
    group: 'Sourcing & Production',
    sortOrder: 2,
  },
  {
    code: 'aggregation:ADD',
    label: 'Group products into containers',
    group: 'Sourcing & Production',
    sortOrder: 3,
  },
  {
    code: 'object:shipping',
    label: 'Dispatch products',
    group: 'Movement',
    sortOrder: 4,
  },
  {
    code: 'object:receiving',
    label: 'Receive products',
    group: 'Movement',
    sortOrder: 5,
  },
  {
    code: 'transaction:bol',
    label: 'Issue bill of lading (BOL)',
    group: 'Movement',
    sortOrder: 6,
  },
  {
    code: 'object:unpacking',
    label: 'Unpack containers',
    group: 'Storage',
    sortOrder: 7,
  },
  {
    code: 'aggregation:DELETE',
    label: 'Separate products from containers',
    group: 'Storage',
    sortOrder: 8,
  },
  {
    code: 'object:inspecting',
    label: 'Inspect quality',
    group: 'Storage',
    sortOrder: 9,
  },
  {
    code: 'transaction:po',
    label: 'Issue purchase orders',
    group: 'Commerce',
    sortOrder: 10,
  },
  {
    code: 'transaction:inv',
    label: 'Issue invoices',
    group: 'Commerce',
    sortOrder: 11,
  },
  {
    code: 'transaction:desadv',
    label: 'Issue despatch advices',
    group: 'Commerce',
    sortOrder: 12,
  },
  {
    code: 'transformation:transforming',
    label: 'Transform materials',
    group: 'Transformation',
    sortOrder: 13,
  },
  {
    code: 'association:ADD',
    label: 'Associate certificates or warranties',
    group: 'Associations',
    sortOrder: 14,
  },
  {
    code: 'association:DELETE',
    label: 'Disassociate certificates or warranties',
    group: 'Associations',
    sortOrder: 15,
  },
] as const;

export type OperationCode = (typeof OPERATIONS)[number]['code'];

export const OPERATION_CODES: readonly string[] = OPERATIONS.map(
  (o) => o.code,
);
