import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  Search, 
  Home, 
  Bath, 
  Square, 
  Euro, 
  MapPin,
  Filter,
  Users,
  Info,
  Star,
  Target
} from 'lucide-react';

export interface Client {
  id: string;
  nombre: string;
  telefono: string;
  mail: string;
  fecha_inclusion: string;
  creado_info: string;
  operation: string;
  types: string[];
  conditions: string[];
  rooms_min: number | null;
  rooms_max: number | null;
  bath_min: number | null;
  bath_max: number | null;
  living_min: number | null;
  living_max: number | null;
  area_min_m2: number | null;
  area_max_m2: number | null;
  price_min_eur: number | null;
  price_max_eur: number | null;
  locations: string[];
  flags: string[];
  zona_std: string;
}

interface ClientSearchPanelProps {
  clients: Client[];
}

export function ClientSearchPanel({ clients }: ClientSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedClient, setExpandedClient] = useState<string>('');
  const maxClientsPerPage = 30;

  // Filtrar clientes por término de búsqueda
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    
    const term = searchTerm.toLowerCase();
    return clients.filter(client => 
      client.nombre.toLowerCase().includes(term) ||
      client.telefono.includes(term) ||
      client.mail.toLowerCase().includes(term) ||
      client.zona_std.toLowerCase().includes(term) ||
      client.types.some(type => type.toLowerCase().includes(term)) ||
      client.locations.some(loc => loc.toLowerCase().includes(term))
    );
  }, [clients, searchTerm]);

  // Paginación
  const totalPages = Math.ceil(filteredClients.length / maxClientsPerPage);
  const startIndex = (currentPage - 1) * maxClientsPerPage;
  const endIndex = startIndex + maxClientsPerPage;
  const currentClients = filteredClients.slice(startIndex, endIndex);

  // Reset página cuando cambian los filtros
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const formatPrice = (price: number | null) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatRange = (min: number | null, max: number | null, unit: string = '') => {
    if (min !== null && max !== null) {
      if (min === max) return `${min}${unit}`;
      return `${min}-${max}${unit}`;
    }
    if (min !== null) return `Desde ${min}${unit}`;
    if (max !== null) return `Hasta ${max}${unit}`;
    return 'Sin especificar';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const getOperationStyle = (operation: string) => {
    if (!operation) return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800';
    
    switch (operation.toLowerCase()) {
      case 'venta':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
      case 'alquiler':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      default:
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
    }
  };

  const stats = useMemo(() => {
    const totalClients = filteredClients.length;
    const clientsWithRequirements = filteredClients.filter(c => 
      c.types.length > 0 || c.rooms_min || c.price_min_eur || c.locations.length > 0
    ).length;
    const clientsWithBudget = filteredClients.filter(c => c.price_min_eur || c.price_max_eur).length;
    const clientsWithLocation = filteredClients.filter(c => c.locations.length > 0).length;
    
    return {
      totalClients,
      clientsWithRequirements,
      clientsWithBudget,
      clientsWithLocation
    };
  }, [filteredClients]);

  if (!clients.length) {
    return (
      <Card className="border-dashed">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No hay clientes disponibles</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Carga el archivo contacts_today_parsed.csv en la carpeta public/ para ver los clientes.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Clientes registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Requisitos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientsWithRequirements}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalClients > 0 ? ((stats.clientsWithRequirements / stats.totalClients) * 100).toFixed(1) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Presupuesto</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientsWithBudget}</div>
            <p className="text-xs text-muted-foreground">
              Definieron rango de precio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Ubicación</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientsWithLocation}</div>
            <p className="text-xs text-muted-foreground">
              Especificaron zona preferida
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Buscar Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="client-search">Buscar por nombre, teléfono, email, zona o tipo de propiedad</Label>
            <Input
              id="client-search"
              placeholder="Escribe para filtrar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            {searchTerm && (
              <p className="text-sm text-muted-foreground">
                Mostrando {stats.totalClients} cliente{stats.totalClients !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controles de paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} • Mostrando {startIndex + 1}-{Math.min(endIndex, filteredClients.length)} de {filteredClients.length} clientes
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
      )}

      {/* Lista de Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {currentClients.map((client) => (
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{client.nombre}</CardTitle>
                    <CardDescription>ID: {client.id}</CardDescription>
                  </div>
                </div>
                {client.operation && (
                  <Badge className={`text-xs px-2 py-1 ${getOperationStyle(client.operation)}`}>
                    {client.operation}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Información de contacto */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{client.telefono || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{client.mail || 'No especificado'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>{formatDate(client.fecha_inclusion)}</span>
                </div>
              </div>

              {/* Tipos de propiedad buscados */}
              {client.types.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tipos buscados:</Label>
                  <div className="flex flex-wrap gap-1">
                    {client.types.map((type, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Requisitos de habitaciones y baños */}
              {(client.rooms_min || client.rooms_max || client.bath_min || client.bath_max) && (
                <div className="grid grid-cols-2 gap-4">
                  {(client.rooms_min || client.rooms_max) && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Home className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-xs text-muted-foreground">Habitaciones:</Label>
                      </div>
                      <p className="text-sm font-medium">
                        {formatRange(client.rooms_min, client.rooms_max)}
                      </p>
                    </div>
                  )}
                  
                  {(client.bath_min || client.bath_max) && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Bath className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-xs text-muted-foreground">Baños:</Label>
                      </div>
                      <p className="text-sm font-medium">
                        {formatRange(client.bath_min, client.bath_max)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Superficie */}
              {(client.area_min_m2 || client.area_max_m2) && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Square className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Superficie:</Label>
                  </div>
                  <p className="text-sm font-medium">
                    {formatRange(client.area_min_m2, client.area_max_m2, ' m²')}
                  </p>
                </div>
              )}

              {/* Presupuesto */}
              {(client.price_min_eur || client.price_max_eur) && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Euro className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Presupuesto:</Label>
                  </div>
                  <p className="text-sm font-medium">
                    {client.price_min_eur && client.price_max_eur ? 
                      `${formatPrice(client.price_min_eur)} - ${formatPrice(client.price_max_eur)}` :
                      client.price_min_eur ? 
                        `Desde ${formatPrice(client.price_min_eur)}` :
                        `Hasta ${formatPrice(client.price_max_eur)}`
                    }
                  </p>
                </div>
              )}

              {/* Ubicaciones preferidas */}
              {client.locations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Ubicaciones preferidas:</Label>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {client.locations.slice(0, 3).map((location, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {location}
                      </Badge>
                    ))}
                    {client.locations.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{client.locations.length - 3} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Información adicional */}
              {client.creado_info && (
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1 mb-1">
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Creado por:</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {client.creado_info.replace(/,$/, '')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}