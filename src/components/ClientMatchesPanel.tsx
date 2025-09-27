import React, { useMemo } from 'react';
import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Property } from './PropertyTable';
import { ExternalLink, User, Chrome as Home, Bath, Square, MapPin, Euro, Star, TrendingUp, Users, Target, Search, Phone, Mail, Calendar } from 'lucide-react';

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

interface ClientMatchesPanelProps {
  properties: Property[];
  matches: ClientMatch[];
  clients?: Client[];
}

export function ClientMatchesPanel({ properties, matches, clients }: ClientMatchesPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClient, setExpandedClient] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const maxClientsPerPage = 30;

  // Filtrar matches por término de búsqueda
  const filteredMatches = useMemo(() => {
    if (!searchTerm.trim()) return matches;
    
    const term = searchTerm.toLowerCase();
    return matches.filter(match => 
      match.client_name.toLowerCase().includes(term) ||
      match.zona.toLowerCase().includes(term) ||
      match.anunciante.toLowerCase().includes(term)
    );
  }, [matches, searchTerm]);

  const clientGroups = useMemo(() => {
    if (!filteredMatches.length) return {};

    // Agrupar matches por cliente
    const groups = filteredMatches.reduce((acc, match) => {
      const clientKey = match.client_id || match.client_name;
      if (!acc[clientKey]) {
        // Buscar información completa del cliente
        const clientInfo = clients?.find(c => c.id === match.client_id);
        
        acc[clientKey] = {
          client_id: match.client_id,
          client_name: match.client_name,
          client_info: clientInfo || {
            id: match.client_id,
            nombre: match.client_name,
            telefono: '',
            mail: '',
            fecha_inclusion: '',
            creado_info: '',
            operation: '',
            types: [],
            conditions: [],
            rooms_min: null,
            rooms_max: null,
            bath_min: null,
            bath_max: null,
            living_min: null,
            living_max: null,
            area_min_m2: null,
            area_max_m2: null,
            price_min_eur: null,
            price_max_eur: null,
            locations: [],
            flags: [],
            zona_std: ''
          },
          matches: []
        };
      }
      acc[clientKey].matches.push(match);
      return acc;
    }, {} as Record<string, { client_id: string; client_name: string; matches: ClientMatch[] }>);

    // Ordenar matches dentro de cada cliente por rank_client
    Object.values(groups).forEach(group => {
      group.matches.sort((a, b) => a.rank_client - b.rank_client);
    });

    return groups;
  }, [filteredMatches, clients]);
  
  const formatRange = (min: number | null, max: number | null, unit: string = '') => {
    if (min !== null && max !== null) {
      if (min === max) return `${min}${unit}`;
      return `${min}-${max}${unit}`;
    }
    if (min !== null) return `Desde ${min}${unit}`;
    if (max !== null) return `Hasta ${max}${unit}`;
    return 'Sin especificar';
  };

  // Paginación de clientes
  const clientList = Object.values(clientGroups);
  const totalPages = Math.ceil(clientList.length / maxClientsPerPage);
  const startIndex = (currentPage - 1) * maxClientsPerPage;
  const endIndex = startIndex + maxClientsPerPage;
  const currentClients = clientList.slice(startIndex, endIndex);

  // Reset página cuando cambian los filtros
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Memoizar cálculos pesados
  const stats = useMemo(() => {
    const totalClients = clientList.length;
    const totalMatches = filteredMatches.length;
    const avgMatchesPerClient = totalClients > 0 ? totalMatches / totalClients : 0;
    const highQualityMatches = filteredMatches.filter(m => m.score >= 0.8).length;
    
    return {
      totalClients,
      totalMatches,
      avgMatchesPerClient,
      highQualityMatches
    };
  }, [clientList, filteredMatches]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatScore = (score: number) => {
    return (score * 100).toFixed(1);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
  };

  const getOperationStyle = (operacion: string) => {
    switch (operacion?.toLowerCase()) {
      case 'venta':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
      case 'alquiler':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800';
    }
  };

  const handleClientToggle = useCallback((clientId: string) => {
    setExpandedClient(prev => prev === clientId ? '' : clientId);
  }, []);

  if (!matches.length) {
    return (
      <Card className="border-dashed">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
            <Target className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No hay matches de clientes</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Carga el archivo matches.csv en la carpeta public/ para ver las coincidencias entre clientes y propiedades.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Matches */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Con propiedades coincidentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMatches}</div>
            <p className="text-xs text-muted-foreground">
              Coincidencias encontradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Cliente</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgMatchesPerClient.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Propiedades por cliente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matches de Alta Calidad</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.highQualityMatches}</div>
            <p className="text-xs text-muted-foreground">
              Score ≥ 80% ({stats.totalMatches > 0 ? ((stats.highQualityMatches / stats.totalMatches) * 100).toFixed(1) : 0}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador de clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Buscar Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="client-search">Buscar por nombre, zona o anunciante</Label>
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
                {' '}con {stats.totalMatches} match{stats.totalMatches !== 1 ? 'es' : ''}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Controles de paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} • Mostrando {startIndex + 1}-{Math.min(endIndex, clientList.length)} de {clientList.length} clientes
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

      {/* Lista de Clientes y sus Matches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Matches por Cliente
          </CardTitle>
          <CardDescription>
            Propiedades recomendadas para cada cliente ordenadas por relevancia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" value={expandedClient} onValueChange={setExpandedClient}>
            {currentClients.map((client) => (
              <AccordionItem key={client.client_id} value={client.client_id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{client.client_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>ID: {client.client_id}</span>
                          {client.client_info?.telefono && (
                            <span>• {client.client_info.telefono}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {client.matches.length} propiedades
                      </Badge>
                      {client.matches.some(m => m.score >= 0.8) && (
                        <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                          <Star className="h-3 w-3 mr-1" />
                          Alta calidad
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4" key={`content-${client.client_id}`}>
                    
                    {/* Información del cliente */}
                    {client.client_info && (
                      <Card className="bg-muted/30">
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            Perfil del Cliente
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Información de contacto */}
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Contacto</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">Nombre:</span>
                                  <span className="font-medium">{client.client_name}</span>
                                </div>
                                {client.client_info.telefono && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Teléfono:</span>
                                    <span className="font-medium">{client.client_info.telefono}</span>
                                  </div>
                                )}
                                {client.client_info.mail && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Email:</span>
                                    <span className="font-medium truncate">{client.client_info.mail}</span>
                                  </div>
                                )}
                                {client.client_info.fecha_inclusion && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Registrado:</span>
                                    <span className="font-medium">{new Date(client.client_info.fecha_inclusion).toLocaleDateString('es-ES')}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Requisitos */}
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Requisitos</h5>
                              <div className="space-y-1 text-sm">
                                {client.client_info.operation && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Operación:</span>
                                    <Badge className={`text-xs px-2 py-1 ${getOperationStyle(client.client_info.operation)}`}>
                                      {client.client_info.operation}
                                    </Badge>
                                  </div>
                                )}
                                
                                {client.client_info.types && client.client_info.types.length > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Tipos:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {client.client_info.types.map((type, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {type}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {(client.client_info.rooms_min || client.client_info.rooms_max) && (
                                  <div className="flex items-center gap-2">
                                    <Home className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Habitaciones:</span>
                                    <span className="font-medium">{formatRange(client.client_info.rooms_min, client.client_info.rooms_max)}</span>
                                  </div>
                                )}
                                
                                {(client.client_info.bath_min || client.client_info.bath_max) && (
                                  <div className="flex items-center gap-2">
                                    <Bath className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Baños:</span>
                                    <span className="font-medium">{formatRange(client.client_info.bath_min, client.client_info.bath_max)}</span>
                                  </div>
                                )}
                                
                                {(client.client_info.area_min_m2 || client.client_info.area_max_m2) && (
                                  <div className="flex items-center gap-2">
                                    <Square className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Superficie:</span>
                                    <span className="font-medium">{formatRange(client.client_info.area_min_m2, client.client_info.area_max_m2, ' m²')}</span>
                                  </div>
                                )}
                                
                                {(client.client_info.price_min_eur || client.client_info.price_max_eur) && (
                                  <div className="flex items-center gap-2">
                                    <Euro className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Presupuesto:</span>
                                    <span className="font-medium">
                                      {client.client_info.price_min_eur && client.client_info.price_max_eur ? 
                                        `${formatPrice(client.client_info.price_min_eur)} - ${formatPrice(client.client_info.price_max_eur)}` :
                                        client.client_info.price_min_eur ? 
                                          `Desde ${formatPrice(client.client_info.price_min_eur)}` :
                                          `Hasta ${formatPrice(client.client_info.price_max_eur)}`
                                      }
                                    </span>
                                  </div>
                                )}
                                
                                {(client.client_info.living_min || client.client_info.living_max) && (
                                  <div className="flex items-center gap-2">
                                    <Home className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Salones:</span>
                                    <span className="font-medium">{formatRange(client.client_info.living_min, client.client_info.living_max)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Información adicional */}
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Información adicional</h5>
                              <div className="space-y-1 text-sm">
                                {client.client_info.creado_info && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">Creado por:</span>
                                    </div>
                                    <p className="text-xs bg-muted/50 p-2 rounded border-l-2 border-primary/20">
                                      {client.client_info.creado_info.replace(/,$/, '')}
                                    </p>
                                  </div>
                                )}
                                
                                {client.client_info.flags && client.client_info.flags.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <Star className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">Flags especiales:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {client.client_info.flags.map((flag, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-200">
                                          {flag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {client.client_info.zona_std && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Zona estándar:</span>
                                    <span className="font-medium text-xs">{client.client_info.zona_std}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Ubicaciones preferidas */}
                          {client.client_info.locations && client.client_info.locations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <h5 className="text-sm font-medium text-muted-foreground mb-2">Ubicaciones preferidas</h5>
                              <div className="flex flex-wrap gap-1">
                                {client.client_info.locations.map((location, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-200">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {location}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Condiciones adicionales */}
                          {client.client_info.conditions && client.client_info.conditions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <h5 className="text-sm font-medium text-muted-foreground mb-2">Condiciones especiales</h5>
                              <div className="flex flex-wrap gap-1">
                                {client.client_info.conditions.map((condition, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/20 dark:border-purple-800 dark:text-purple-200">
                                    {condition}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Resumen rápido de contacto */}
                          <div className="mt-4 pt-3 border-t border-border/50 bg-primary/5 rounded-lg p-3">
                            <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Phone className="h-4 w-4 text-primary" />
                              Contacto rápido
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {client.client_info.telefono && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 justify-start text-xs"
                                  onClick={() => window.open(`tel:${client.client_info.telefono}`, '_self')}
                                >
                                  <Phone className="h-3 w-3 mr-1" />
                                  Llamar
                                </Button>
                              )}
                              {client.client_info.mail && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 justify-start text-xs"
                                  onClick={() => window.open(`mailto:${client.client_info.mail}`, '_self')}
                                >
                                  <Mail className="h-3 w-3 mr-1" />
                                  Email
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {client.matches.slice(0, 20).map((match) => (
                        <Card key={match.property_id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4 space-y-3">
                            {/* Header con score y ranking */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs px-2 py-1 ${getScoreColor(match.score)}`}>
                                  {formatScore(match.score)}% match
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  #{match.rank_client}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => window.open(match.link_inmueble, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Información básica */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs px-2 py-1 ${getOperationStyle(match.operacion)}`}>
                                  {match.operacion || 'N/A'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">{match.web}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm font-medium truncate">
                                  {match.zona.includes("'municipio'") ? 
                                    match.zona.split("'municipio': '")[1]?.split("'")[0] || match.zona :
                                    match.zona
                                  }
                                </span>
                              </div>

                              <div className="text-lg font-bold text-primary">
                                {formatPrice(match.precio)}
                              </div>
                            </div>

                            {/* Características */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                                <Home className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium">{match.habitaciones}</span>
                              </div>
                              
                              <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                                <Bath className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium">{match.banos}</span>
                              </div>
                              
                              <div className="flex items-center gap-1 bg-muted/30 rounded-md p-2">
                                <Square className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium">{match.m2}m²</span>
                              </div>
                            </div>

                            {/* Scores detallados */}
                            <div className="pt-2 border-t border-border/50">
                              <p className="text-xs text-muted-foreground mb-2">Scores de coincidencia:</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex justify-between">
                                  <span>Precio:</span>
                                  <span className="font-medium">{formatScore(match.s_price)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Área:</span>
                                  <span className="font-medium">{formatScore(match.s_area)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Habitaciones:</span>
                                  <span className="font-medium">{formatScore(match.s_rooms)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Baños:</span>
                                  <span className="font-medium">{formatScore(match.s_baths)}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Anunciante */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate">{match.anunciante}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {client.matches.length > 20 && (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          Mostrando los primeros 20 de {client.matches.length} matches
                        </p>
                      </div>
                    )}

                    {/* Resumen del cliente */}
                    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-2">Resumen para {client.client_name}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total matches:</p>
                          <p className="font-medium">{client.matches.length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Mejor score:</p>
                          <p className="font-medium">{formatScore(Math.max(...client.matches.map(m => m.score)))}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Precio promedio:</p>
                          <p className="font-medium">
                            {formatPrice(client.matches.reduce((sum, m) => sum + m.precio, 0) / client.matches.length)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Matches alta calidad:</p>
                          <p className="font-medium">
                            {client.matches.filter(m => m.score >= 0.8).length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}