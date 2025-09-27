import React from 'react';
import { ExternalLink, Chrome as Home, Bath, Square, MapPin, Calendar, User, Globe } from 'lucide-react';
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

interface PropertyTableProps {
  properties: Property[];
  viewMode?: 'cards' | 'list';
  maxItems?: number;
}

export function PropertyTable({ properties, viewMode = 'cards', maxItems = 30 }: PropertyTableProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Calcular paginación
  const totalPages = Math.ceil(properties.length / maxItems);
  const startIndex = (currentPage - 1) * maxItems;
  const endIndex = startIndex + maxItems;
  const currentProperties = properties.slice(startIndex, endIndex);
  
  // Reset página cuando cambian las propiedades
  React.useEffect(() => {
    setCurrentPage(1);
  }, [properties.length]);

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

  if (currentProperties.length === 0 && properties.length === 0) {
    return (
      <Card className="border-dashed">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
            <Home className="h-8 w-8 text-muted-foreground" />
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
          Mostrando {startIndex + 1}-{Math.min(endIndex, properties.length)} de {properties.length} propiedades
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center">Hab</TableHead>
                    <TableHead className="text-center">Baños</TableHead>
                    <TableHead className="text-center">m²</TableHead>
                    <TableHead className="min-w-32">Anunciante</TableHead>
                    <TableHead>Web</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProperties.map((property) => {
                  const operationStyle = getOperationStyle(property.tipo_de_operacion);
                  
                  return (
                    <TableRow 
                      key={property.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell>
                        <Badge className={`text-xs px-2 py-1 ${operationStyle}`}>
                          {property.tipo_de_operacion}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{property.zona}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCompactPrice(property.precio)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Home className="h-3 w-3 text-muted-foreground" />
                          <span>{property.habitaciones}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Bath className="h-3 w-3 text-muted-foreground" />
                          <span>{property.baños}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Square className="h-3 w-3 text-muted-foreground" />
                          <span>{property.metros_cuadrados}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 truncate">
                          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate text-sm">{property.anunciante}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{property.web}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{formatDate(property.fecha_inclusion)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => window.open(property.link_inmueble, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="sr-only">Ver propiedad</span>
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
      <div className="flex gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          <span>Venta</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>Alquiler</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span>Otro</span>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentProperties.map((property) => {
          const operationStyle = getOperationStyle(property.tipo_de_operacion);
          
          return (
            <Card 
              key={property.id} 
              className="group hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer"
              onClick={() => window.open(property.link_inmueble, '_blank')}
            >
              <CardContent className="p-4 space-y-3">
                {/* Header con tipo y enlace */}
                <div className="flex items-start justify-between">
                  <Badge className={`text-xs px-2 py-1 ${operationStyle}`}>
                    {property.tipo_de_operacion}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(property.link_inmueble, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Ubicación */}
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{property.zona}</span>
                </div>

                {/* Precio principal */}
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-foreground">
                    {formatCompactPrice(property.precio)}
                  </div>
                </div>

                {/* Características en grid compacto */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                    <Home className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium">{property.habitaciones}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                    <Bath className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium">{property.baños}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                    <Square className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium">{property.metros_cuadrados}m²</span>
                  </div>
                </div>

                {/* Footer con información adicional */}
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 truncate">
                      <User className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{property.anunciante}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>{property.web}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
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