export interface DemoEpcLink {
  urn: string;
  label: string;
  actor: string;
}

export interface DemoProductLink {
  id: string;
  name: string;
  owner: string;
}

export interface DemoNoticeLink {
  id: string;
  title: string;
  productId: string;
}

export const DEMO_EPCS: DemoEpcLink[] = [
  {
    urn: 'urn:nodoo:epc:d71dd322-2b92-4a06-a4eb-8a1b43efecc0',
    label: 'Tostado 500 g — activo',
    actor: 'Cafeterías La Vela',
  },
  {
    urn: 'urn:nodoo:epc:7833feff-792d-4be1-bfa7-e376505c9a9d',
    label: 'Tostado 500 g — activo',
    actor: 'Distribuciones Andina',
  },
  {
    urn: 'urn:nodoo:epc:236af542-6576-4e2f-987f-5239e1f3c3fe',
    label: 'Verde 1 kg — consumido',
    actor: 'Tostaduría Aroma',
  },
  {
    urn: 'urn:nodoo:epc:6f5b5502-54f5-44a8-b0fb-493aedba7592',
    label: 'Verde 1 kg — consumido',
    actor: 'Tostaduría Aroma',
  },
  {
    urn: 'urn:nodoo:epc:c629e5de-acc8-4fd7-88e8-4830d3018eda',
    label: 'Verde 1 kg — consumido',
    actor: 'Tostaduría Aroma',
  },
];

export const DEMO_PRODUCTS: DemoProductLink[] = [
  {
    id: 'af1e073a-0216-4288-8b90-adc3639fe2c7',
    name: 'Café verde 1kg',
    owner: 'Finca El Roble',
  },
  {
    id: '6b76c49e-de79-45ea-9e84-78bb737d4453',
    name: 'Café tostado 500g',
    owner: 'Tostaduría Aroma',
  },
];

export const DEMO_NOTICES: DemoNoticeLink[] = [
  {
    id: '9fe65a02-0b8c-4a02-8afc-726d0ed00c8a',
    title: 'Aviso de control de humedad — lote RST-2026-1117-A',
    productId: '6b76c49e-de79-45ea-9e84-78bb737d4453',
  },
];
