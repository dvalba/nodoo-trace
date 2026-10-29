export const ACTIVITY_TYPES = [
  {
    code: 'supplier',
    name: 'Supplier',
    description: 'Company that supplies raw materials or goods.',
  },
  {
    code: 'manufacturer',
    name: 'Manufacturer',
    description: 'Company that transforms raw materials into finished products.',
  },
  {
    code: 'intl_carrier',
    name: 'Intl Carrier',
    description: 'Carrier operating across countries or regions.',
  },
  {
    code: 'warehouse',
    name: 'Warehouse',
    description: 'Facility that stores goods before distribution.',
  },
  {
    code: 'wholesaler',
    name: 'Wholesaler',
    description: 'Intermediary that buys in bulk and resells to retailers.',
  },
  {
    code: 'local_carrier',
    name: 'Local Carrier',
    description: 'Carrier operating within a region or city.',
  },
  {
    code: 'retailer',
    name: 'Retailer',
    description: 'Company that sells directly to the end consumer.',
  },
  {
    code: 'auditor_consumer',
    name: 'Auditor or Consumer',
    description: 'Actor that audits the chain or consumes the final product.',
  },
] as const;

export type ActivityCode = (typeof ACTIVITY_TYPES)[number]['code'];
export type ActivityTypeSeed = (typeof ACTIVITY_TYPES)[number];

export const PERMISSIONS = {
  'object:commissioning': ['supplier', 'manufacturer'],
  'object:shipping': ['supplier', 'manufacturer', 'intl_carrier', 'warehouse', 'wholesaler', 'local_carrier', 'retailer'],
  'object:receiving': ['manufacturer', 'intl_carrier', 'warehouse', 'wholesaler', 'local_carrier', 'retailer'],
  'object:packing': ['supplier', 'manufacturer', 'warehouse', 'wholesaler'],
  'object:unpacking': ['warehouse', 'wholesaler', 'retailer'],
  'object:inspecting': ['manufacturer', 'intl_carrier', 'warehouse', 'wholesaler', 'local_carrier', 'retailer', 'auditor_consumer'],

  'aggregation:ADD': ['supplier', 'manufacturer', 'warehouse', 'wholesaler'],
  'aggregation:DELETE': ['warehouse', 'wholesaler', 'retailer'],

  'transaction:po': ['manufacturer', 'warehouse', 'wholesaler', 'retailer'],
  'transaction:inv': ['supplier', 'manufacturer', 'warehouse', 'wholesaler'],
  'transaction:desadv': ['supplier', 'manufacturer', 'warehouse', 'wholesaler'],
  'transaction:bol': ['intl_carrier', 'local_carrier'],

  'transformation:transforming': ['manufacturer'],

  'association:ADD': ['supplier', 'manufacturer', 'warehouse', 'wholesaler'],
  'association:DELETE': ['warehouse', 'wholesaler', 'retailer'],
} satisfies Record<string, readonly ActivityCode[]>;

export type Operation = keyof typeof PERMISSIONS;