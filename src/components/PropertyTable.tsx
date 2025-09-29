import React from 'react';
import { ExternalLink, Bed, Bath, Square, MapPin, Calendar, User, Globe, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export interface Property {
  id: number;
  habitaciones: number;
  baños: number;
  precio: number;
  link_inmueble: string;
  metros_cuadrados: number;
  anunciante: string;
  zona: string;
  web: string;
  fecha_inclusion: string;
  tipo_de_operacion: 'Venta' | 'Alquiler' | 'Otro';
}

export interface ClientMatch {
  client_id: string;
  client_name: string;
  property_id: string;
  link_inmueble: string;
  web: string;
  anunciante: string;
  zona: string;
  operacion: string;
  tipo: string;
  habitaciones: number;
  banos: number;
  m2: number;
  precio: number;
  score: number;
  s_price: number;
  s_area: number;
  s_rooms: number;
  s_baths: number;
  s_operation: number;
  zone_match: string;
  type_match: string;
  rank_client: number;
}

type SortField = 'precio' | 'habitaciones' | 'baños' | 'metros_cuadrados' | 'zona' | 'anunciante' | 'fecha_inclusion' | 'matches_count';
type SortDirection = 'asc' | 'desc' | null;

interface PropertyTableProps {
  properties: Property[];
  viewMode?: 'cards' | 'list';
  maxItems?: number;
  matches?: ClientMatch[];
}

export function PropertyTable({ properties, viewMode = 'cards', maxItems = 30, matches = [] }: PropertyTableProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortField, setSortField] = React.useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);
  
  // Calcular matches por propiedad
  const propertyMatches = React.useMemo(() => {
    const matchMap = new Map<string, { total: number; highQuality: number }>();
    
    matches.forEach(match => {
      // Usar property_id como clave principal, fallback a link_inmueble
      const propertyKey = match.property_id || match.link_inmueble;
      if (!matchMap.has(propertyKey)) {
        matchMap.set(propertyKey, { total: 0, highQuality: 0 });
      }
      const current = matchMap.get(propertyKey)!;
      current.total++;
      if (match.score >= 0.8) {
        current.highQuality++;
      }
    });
    
    return matchMap;
  }, [matches]);
  
  // Función para obtener matches de una propiedad
  const getPropertyMatches = (property: Property) => {
    // Buscar matches usando diferentes claves posibles
    let matchInfo = propertyMatches.get(property.id.toString());
    
    if (!matchInfo) {
      matchInfo = propertyMatches.get(property.link_inmueble);
    }
    
    // Si aún no hay matches, intentar buscar por URL sin protocolo/dominio
    if (!matchInfo && property.link_inmueble) {
      const urlPath = property.link_inmueble.replace(/^https?:\/\/[^\/]+/, '');
      for (const [key, value] of propertyMatches.entries()) {
        if (key.includes(urlPath) || urlPath.includes(key)) {
          matchInfo = value;
          break;
        }
      }
    }
    
    return matchInfo || { total: 0, highQuality: 0 };
    return matchInfo;
  };
  
  // Función de ordenamiento
  const sortedProperties = React.useMemo(() => {
    if (!sortField || !sortDirection) return properties;
    
    return [...properties].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      // Manejar ordenamiento por matches
      if (sortField === 'matches_count') {
        aValue = getPropertyMatches(a).highQuality;
        bValue = getPropertyMatches(b).highQuality;
      }
      // Manejar valores especiales
      else if (sortField === 'precio') {
        aValue = typeof aValue === 'number' ? aValue : 0;
        bValue = typeof bValue === 'number' ? bValue : 0;
      } else if (sortField === 'fecha_inclusion') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [properties, sortField, sortDirection, propertyMatches]);
  
  // Calcular paginación con datos ordenados
  const totalPages = Math.ceil(sortedProperties.length / maxItems);
  const startIndex = (currentPage - 1) * maxItems;
  const endIndex = startIndex + maxItems;
  const currentProperties = sortedProperties.slice(startIndex, endIndex);
  
  // Reset página cuando cambian las propiedades
  React.useEffect(() => {
    setCurrentPage(1);
  }, [sortedProperties.length, matches.length]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Ciclar: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-3 w-3" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-3 w-3" />;
    return <ArrowUpDown className="h-3 w-3 opacity-50" />;
  };

  const getSortAriaLabel = (field: SortField, label: string) => {
    if (sortField !== field) return `Ordenar por ${label}`;
    if (sortDirection === 'asc') return `${label} ordenado ascendente, click para descendente`;
    if (sortDirection === 'desc') return `${label} ordenado descendente, click para quitar orden`;
    return `Ordenar por ${label}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatCompactPrice = (price: number) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M€`;
    } else if (price >= 1000) {
      return `${(price / 1000).toFixed(0)}K€`;
    }
    return `${price}€`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getOperationStyle = (tipo: string) => {
    if (!tipo) {
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800';
    }
    
    switch (tipo) {
      case 'Venta':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
      case 'Alquiler':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'Otro':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800';
    }
  };

  const getMatchesBadgeStyle = (highQuality: number, total: number) => {
    if (highQuality === 0) {
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
    if (highQuality >= 5) {
      return 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-300 dark:from-green-900/30 dark:to-emerald-900/30 dark:text-green-300 dark:border-green-700';
    }
    if (highQuality >= 3) {
      return 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-300 dark:from-yellow-900/30 dark:to-amber-900/30 dark:text-yellow-300 dark:border-yellow-700';
    }
    return 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 border-blue-300 dark:from-blue-900/30 dark:to-cyan-900/30 dark:text-blue-300 dark:border-blue-700';
  };
  if (currentProperties.length === 0 && sortedProperties.length === 0) {
    return (
      <Card className="border-dashed">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No se encontraron propiedades</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Ajusta los filtros para ver más resultados o carga un archivo CSV con datos.
          </p>
        </div>
      </Card>
    );
  }

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-muted-foreground">
          Mostrando {startIndex + 1}-{Math.min(endIndex, sortedProperties.length)} de {sortedProperties.length} propiedades
          {sortField && sortDirection && (
            <span className="ml-2">
              (ordenado por {sortField} {sortDirection === 'asc' ? 'ascendente' : 'descendente'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            aria-label="Ir a la página anterior"
          >
            Anterior
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                  className="w-8 h-8 p-0"
                  aria-label={`Ir a la página ${pageNum}`}
                  aria-current={currentPage === pageNum ? "page" : undefined}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            aria-label="Ir a la página siguiente"
          >
            Siguiente
          </Button>
        </div>
      </div>
    );
  };

  // Vista de lista (tabla)
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto" role="region" aria-label="Tabla de propiedades inmobiliarias">
              <Table>
                <caption className="sr-only">
                  Lista de {sortedProperties.length} propiedades inmobiliarias con información detallada de precio, ubicación y características. 
                  {sortField && sortDirection && ` Ordenada por ${sortField} en orden ${sortDirection === 'asc' ? 'ascendente' : 'descendente'}.`}
                  Usa las teclas de flecha para navegar y Enter o Espacio para activar controles.
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20" scope="col">
                      <span>Tipo de operación</span>
                    </TableHead>
                    <TableHead scope="col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('zona')}
                        aria-label={getSortAriaLabel('zona', 'ubicación')}
                      >
                        <span>Ubicación</span>
                        {getSortIcon('zona')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right" scope="col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent ml-auto flex items-center gap-1"
                        onClick={() => handleSort('precio')}
                        aria-label={getSortAriaLabel('precio', 'precio')}
                      >
                        <span>Precio</span>
                        {getSortIcon('precio')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center" scope="col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('habitaciones')}
                        aria-label={getSortAriaLabel('habitaciones', 'habitaciones')}
                      >
                        <span>Hab</span>
                        {getSortIcon('habitaciones')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center" scope="col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('baños')}
                        aria-label={getSortAriaLabel('baños', 'baños')}
                      >
                        <span>Baños</span>
                        {getSortIcon('baños')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center" scope="col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('metros_cuadrados')}
                        aria-label={getSortAriaLabel('metros_cuadrados', 'metros cuadrados')}
                      >
                        <span>m²</span>
                        {getSortIcon('metros_cuadrados')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-center" scope="col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('matches_count')}
                        aria-label={getSortAriaLabel('matches_count', 'matches de calidad')}
                      >
                        <span>Matches</span>
                        {getSortIcon('matches_count')}
                      </Button>
                    </TableHead>
                    <TableHead className="min-w-32" scope="col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('anunciante')}
                        aria-label={getSortAriaLabel('anunciante', 'anunciante')}
                      >
                        <span>Anunciante</span>
                        {getSortIcon('anunciante')}
                      </Button>
                    </TableHead>
                    <TableHead scope="col">
                      <span>Web</span>
                    </TableHead>
                    <TableHead scope="col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-medium hover:bg-transparent"
                        onClick={() => handleSort('fecha_inclusion')}
                        aria-label={getSortAriaLabel('fecha_inclusion', 'fecha de inclusión')}
                      >
                        <span>Fecha</span>
                        {getSortIcon('fecha_inclusion')}
                      </Button>
                    </TableHead>
                    <TableHead className="w-16" scope="col">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProperties.map((property) => {
                  const operationStyle = getOperationStyle(property.tipo_de_operacion);
                  const matchInfo = getPropertyMatches(property);
                  
                  return (
                    <TableRow 
                      key={property.id}
                      className="hover:bg-muted/30 transition-colors focus-within:bg-muted/50"
                      role="row"
                    >
                      <TableCell role="gridcell">
                        <Badge 
                          className={`text-xs px-2 py-1 ${operationStyle}`}
                          aria-label={`Tipo de operación: ${property.tipo_de_operacion}`}
                        >
                          {property.tipo_de_operacion}
                        </Badge>
                      </TableCell>
                      <TableCell role="gridcell">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                          <span className="font-medium truncate">{property.zona}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium" role="gridcell">
                        {formatCompactPrice(property.precio)}
                      </TableCell>
                      <TableCell className="text-center" role="gridcell">
                        <div className="flex items-center justify-center gap-1">
                          <Bed className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          <span>{property.habitaciones}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center" role="gridcell">
                        <div className="flex items-center justify-center gap-1">
                          <Bath className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          <span>{property.baños}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center" role="gridcell">
                        <div className="flex items-center justify-center gap-1">
                          <Square className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          <span>{property.metros_cuadrados}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center" role="gridcell">
                        <div className="flex flex-col items-center gap-1">
                          <Badge 
                            className={`text-xs px-2 py-1 ${getMatchesBadgeStyle(matchInfo.highQuality, matchInfo.total)}`}
                            aria-label={`${matchInfo.highQuality} matches de alta calidad de ${matchInfo.total} totales`}
                          >
                            {matchInfo.highQuality > 0 ? `${matchInfo.highQuality}` : '0'}
                          </Badge>
                          {matchInfo.total > 0 && (
                            <span className="text-xs text-muted-foreground">
                              de {matchInfo.total}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell role="gridcell">
                        <div className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                          <span className="truncate text-sm">{property.anunciante}</span>
                        </div>
                      </TableCell>
                      <TableCell role="gridcell">
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          <span className="text-sm">{property.web}</span>
                        </div>
                      </TableCell>
                      <TableCell role="gridcell">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          <span className="text-sm">{formatDate(property.fecha_inclusion)}</span>
                        </div>
                      </TableCell>
                      <TableCell role="gridcell">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => window.open(property.link_inmueble, '_blank')}
                          aria-label={`Ver detalles de la propiedad en ${property.zona}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <PaginationControls />
      </div>
    );
  }

  // Vista de tarjetas (cards)
  return (
    <div className="space-y-4">
      {/* Información de ordenamiento para vista de tarjetas */}
      {sortField && sortDirection && (
        <div className="text-sm text-muted-foreground">
          Ordenado por {sortField} ({sortDirection === 'asc' ? 'ascendente' : 'descendente'})
        </div>
      )}
      
      <div className="flex gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-emerald-500 rounded-full" aria-hidden="true"></div>
          <span>Venta</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full" aria-hidden="true"></div>
          <span>Alquiler</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full" aria-hidden="true"></div>
          <span>Otro</span>
        </div>
        <div className="flex items-center gap-1 ml-4">
          <div className="w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></div>
          <span>Matches alta calidad (≥80%)</span>
        </div>
      </div>

      <div className="space-y-6">
        <div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          role="grid"
          aria-label={`Cuadrícula de ${currentProperties.length} propiedades inmobiliarias`}
        >
          {currentProperties.map((property) => {
          const operationStyle = getOperationStyle(property.tipo_de_operacion);
          const matchInfo = getPropertyMatches(property);
          
          return (
            <Card 
              key={property.id} 
              className="group hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer"
              onClick={() => window.open(property.link_inmueble, '_blank')}
              role="gridcell"
              tabIndex={0}
              aria-label={`Propiedad en ${property.zona}, ${property.habitaciones} habitaciones, ${formatCompactPrice(property.precio)}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.open(property.link_inmueble, '_blank');
                }
              }}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header con tipo y enlace */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={`text-xs px-2 py-1 ${operationStyle}`}
                      aria-label={`Tipo: ${property.tipo_de_operacion}`}
                    >
                      {property.tipo_de_operacion}
                    </Badge>
                    {matchInfo.total > 0 && (
                      <Badge 
                        className={`text-xs px-2 py-1 ${getMatchesBadgeStyle(matchInfo.highQuality, matchInfo.total)}`}
                        aria-label={`${matchInfo.highQuality} matches de alta calidad`}
                      >
                        <Target className="h-3 w-3 mr-1" />
                        {matchInfo.highQuality}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(property.link_inmueble, '_blank');
                    }}
                    aria-label={`Abrir enlace externo para propiedad en ${property.zona}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Ubicación */}
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium truncate">{property.zona}</span>
                </div>

                {/* Precio principal */}
                <div className="space-y-1" aria-label={`Precio: ${formatCompactPrice(property.precio)}`}>
                  <div className="text-2xl font-bold text-foreground">
                    {formatCompactPrice(property.precio)}
                  </div>
                </div>

                {/* Características en grid compacto */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                    <Bed className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <span className="text-xs font-medium">{property.habitaciones}</span>
                    <span className="sr-only">habitaciones</span>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                    <Bath className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <span className="text-xs font-medium">{property.baños}</span>
                    <span className="sr-only">baños</span>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                    <Square className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <span className="text-xs font-medium">{property.metros_cuadrados}m²</span>
                    <span className="sr-only">metros cuadrados</span>
                  </div>
                </div>

                {/* Información de matches si existen */}
                {matchInfo.total > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800 dark:text-green-200">
                          Matches de Clientes
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-700 dark:text-green-300">
                          {matchInfo.highQuality}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          de {matchInfo.total} total{matchInfo.total !== 1 ? 'es' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-green-700 dark:text-green-300">
                      {matchInfo.highQuality > 0 ? 
                        `${matchInfo.highQuality} cliente${matchInfo.highQuality !== 1 ? 's' : ''} muy interesado${matchInfo.highQuality !== 1 ? 's' : ''}` :
                        'Sin matches de alta calidad'
                      }
                    </div>
                  </div>
                )}
                {/* Footer con información adicional */}
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 truncate">
                      <User className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{property.anunciante}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" aria-hidden="true" />
                      <span>{property.web}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    <span>{formatDate(property.fecha_inclusion)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
        <PaginationControls />
      </div>
    </div>
  );
}