export const OPERATION_LABELS: Record<string, string> = {
  'object:commissioning': 'Crear identidades de producto',
  'object:packing': 'Empacar productos en cajas',
  'aggregation:ADD': 'Agrupar cajas en pallets o contenedores',
  'object:shipping': 'Despachar / enviar productos',
  'object:receiving': 'Recibir productos',
  'transaction:bol': 'Emitir guía de remisión (BOL)',
  'object:unpacking': 'Desempacar contenedores',
  'aggregation:DELETE': 'Separar cajas de pallets o contenedores',
  'object:inspecting': 'Inspeccionar calidad',
  'transaction:po': 'Emitir órdenes de compra',
  'transaction:inv': 'Emitir facturas',
  'transaction:desadv': 'Emitir avisos de despacho',
  'transformation:transforming': 'Transformar materias primas',
  'association:ADD': 'Asociar certificados o garantías',
  'association:DELETE': 'Desasociar certificados o garantías',
};

export const OPERATION_HINTS: Record<string, string> = {
  'object:commissioning':
    'Registrar cada unidad (caja) con un identificador único.',
  'object:packing': 'Meter unidades dentro de una caja o empaque.',
  'aggregation:ADD': 'Agrupar varias cajas en un pallet o contenedor.',
  'object:shipping': 'Sacar productos de tu instalación y ponerlos en tránsito.',
  'object:receiving': 'Confirmar que recibes productos y quedas como custodio.',
  'transaction:bol': 'Documento de transporte que acompaña la carga.',
  'object:unpacking': 'Abrir cajas o contenedores recibidos.',
  'aggregation:DELETE': 'Sacar cajas de un pallet o contenedor.',
  'object:inspecting': 'Revisar el estado o la calidad de un producto.',
  'transaction:po': 'Pedir productos a un proveedor.',
  'transaction:inv': 'Emitir la factura y transferir la propiedad.',
  'transaction:desadv': 'Avisar al comprador qué se le está enviando.',
  'transformation:transforming':
    'Convertir materias primas en un producto nuevo.',
  'association:ADD': 'Vincular certificados, garantías o documentos.',
  'association:DELETE': 'Quitar certificados o documentos vinculados.',
};

export const OPERATION_GROUP_LABELS: Record<string, string> = {
  'Sourcing & Production': 'Origen y producción',
  Movement: 'Movimiento',
  Storage: 'Almacenamiento',
  Commerce: 'Comercio',
  Transformation: 'Transformación',
  Associations: 'Asociaciones',
};

export const ACTIVITY_LABELS: Record<string, string> = {
  supplier: 'Proveedor',
  manufacturer: 'Fabricante',
  intl_carrier: 'Transportista internacional',
  warehouse: 'Almacén o centro de distribución',
  wholesaler: 'Mayorista / distribuidor',
  local_carrier: 'Transportista local',
  retailer: 'Minorista / punto de venta',
  auditor_consumer: 'Auditor o consumidor final',
};

export const ACTIVITY_HINTS: Record<string, string> = {
  supplier: 'Vende o entrega materias primas o mercancía.',
  manufacturer: 'Fabrica o transforma productos.',
  intl_carrier: 'Transporta carga entre países o regiones.',
  warehouse: 'Almacena mercancía antes de distribuirla.',
  wholesaler: 'Compra al por mayor y distribuye a minoristas.',
  local_carrier: 'Transporta carga dentro de una ciudad o región.',
  retailer: 'Vende al consumidor final.',
  auditor_consumer: 'Audita la cadena o consume el producto final.',
};

export function operationLabel(code: string, fallback?: string): string {
  return OPERATION_LABELS[code] ?? fallback ?? code;
}

export function operationHint(code: string): string {
  return OPERATION_HINTS[code] ?? '';
}

export function operationGroupLabel(group: string): string {
  return OPERATION_GROUP_LABELS[group] ?? group;
}

export const USER_ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  member: 'Miembro',
  viewer: 'Observador',
  admin: 'Administrador',
};

export function userRoleLabel(role: string): string {
  return USER_ROLE_LABELS[role] ?? role;
}

export function activityLabel(code: string, fallback?: string): string {
  return ACTIVITY_LABELS[code] ?? fallback ?? code;
}

export function activityHint(code: string): string {
  return ACTIVITY_HINTS[code] ?? '';
}
