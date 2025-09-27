import { Property } from './PropertyTable';

export const mockProperties: Property[] = [
  {
    id: 1,
    habitaciones: 3,
    baños: 2,
    precio: 350000,
    link_inmueble: 'https://ejemplo.com/propiedad1',
    metros_cuadrados: 85,
    anunciante: 'Inmobiliaria García',
    zona: 'Centro',
    web: 'Idealista',
    fecha_inclusion: '2024-01-15',
    tipo_de_operacion: 'Venta'
  },
  {
    id: 2,
    habitaciones: 2,
    baños: 1,
    precio: 1200,
    link_inmueble: 'https://ejemplo.com/propiedad2',
    metros_cuadrados: 65,
    anunciante: 'Propiedades Madrid',
    zona: 'Malasaña',
    web: 'Fotocasa',
    fecha_inclusion: '2024-01-20',
    tipo_de_operacion: 'Alquiler'
  },
  {
    id: 3,
    habitaciones: 4,
    baños: 3,
    precio: 520000,
    link_inmueble: 'https://ejemplo.com/propiedad3',
    metros_cuadrados: 120,
    anunciante: 'HomeFinder',
    zona: 'Chamberí',
    web: 'Idealista',
    fecha_inclusion: '2024-01-25',
    tipo_de_operacion: 'Venta'
  },
  {
    id: 4,
    habitaciones: 1,
    baños: 1,
    precio: 800,
    link_inmueble: 'https://ejemplo.com/propiedad4',
    metros_cuadrados: 45,
    anunciante: 'Alquileres Plus',
    zona: 'La Latina',
    web: 'Habitaclia',
    fecha_inclusion: '2024-02-01',
    tipo_de_operacion: 'Alquiler'
  },
  {
    id: 5,
    habitaciones: 5,
    baños: 4,
    precio: 750000,
    link_inmueble: 'https://ejemplo.com/propiedad5',
    metros_cuadrados: 150,
    anunciante: 'Luxury Homes',
    zona: 'Salamanca',
    web: 'Engel & Völkers',
    fecha_inclusion: '2024-02-05',
    tipo_de_operacion: 'Venta'
  },
  {
    id: 6,
    habitaciones: 3,
    baños: 2,
    precio: 1500,
    link_inmueble: 'https://ejemplo.com/propiedad6',
    metros_cuadrados: 90,
    anunciante: 'Rent & Go',
    zona: 'Chueca',
    web: 'Spotahome',
    fecha_inclusion: '2024-02-10',
    tipo_de_operacion: 'Alquiler'
  },
  {
    id: 7,
    habitaciones: 2,
    baños: 2,
    precio: 420000,
    link_inmueble: 'https://ejemplo.com/propiedad7',
    metros_cuadrados: 75,
    anunciante: 'Inmobiliaria García',
    zona: 'Retiro',
    web: 'Idealista',
    fecha_inclusion: '2024-02-12',
    tipo_de_operacion: 'Venta'
  },
  {
    id: 8,
    habitaciones: 4,
    baños: 2,
    precio: 1800,
    link_inmueble: 'https://ejemplo.com/propiedad8',
    metros_cuadrados: 110,
    anunciante: 'Madrid Premium',
    zona: 'Moncloa',
    web: 'Fotocasa',
    fecha_inclusion: '2024-02-15',
    tipo_de_operacion: 'Alquiler'
  },
  {
    id: 9,
    habitaciones: 3,
    baños: 1,
    precio: 380000,
    link_inmueble: 'https://ejemplo.com/propiedad9',
    metros_cuadrados: 80,
    anunciante: 'Casas del Sur',
    zona: 'Lavapiés',
    web: 'Habitaclia',
    fecha_inclusion: '2024-02-18',
    tipo_de_operacion: 'Venta'
  },
  {
    id: 10,
    habitaciones: 6,
    baños: 5,
    precio: 2500,
    link_inmueble: 'https://ejemplo.com/propiedad10',
    metros_cuadrados: 200,
    anunciante: 'Luxury Homes',
    zona: 'Salamanca',
    web: 'Engel & Völkers',
    fecha_inclusion: '2024-02-20',
    tipo_de_operacion: 'Otro'
  },
  {
    id: 11,
    habitaciones: 2,
    baños: 1,
    precio: 950,
    link_inmueble: 'https://ejemplo.com/propiedad11',
    metros_cuadrados: 55,
    anunciante: 'QuickRent',
    zona: 'Arganzuela',
    web: 'Badi',
    fecha_inclusion: '2024-02-22',
    tipo_de_operacion: 'Alquiler'
  },
  {
    id: 12,
    habitaciones: 1,
    baños: 1,
    precio: 280000,
    link_inmueble: 'https://ejemplo.com/propiedad12',
    metros_cuadrados: 40,
    anunciante: 'Starter Homes',
    zona: 'Tetuán',
    web: 'Idealista',
    fecha_inclusion: '2024-02-25',
    tipo_de_operacion: 'Venta'
  }
];

export function getUniqueZonas(properties: Property[]): string[] {
  const zonas = [...new Set(properties.map(p => p.zona))];
  return zonas.sort();
}

export function getUniqueAnunciantes(properties: Property[]): string[] {
  const anunciantes = [...new Set(properties.map(p => p.anunciante))];
  return anunciantes.sort();
}

export function getUniqueTiposOperacion(properties: Property[]): string[] {
  const tipos = [...new Set(properties.map(p => p.tipo_de_operacion))];
  return tipos.sort();
}