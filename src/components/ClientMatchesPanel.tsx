import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { User, Phone, Mail, Calendar, Search, ListFilter as Filter, Bath, Square, Euro, MapPin, Users, Info, Star, Target, ExternalLink, Building2, TrendingUp } from 'lucide-react';
import { Property, ClientMatch } from './PropertyTable';

interface Client {
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

interface ClientMatchesPanelProps {
  properties: Property[];
  matches: ClientMatch[];
  clients: Client[];
}

export function ClientMatchesPanel({ properties, matches, clients }: ClientMatchesPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [anuncianteFilter, setAnuncianteFilter] = useState<string>('all'); // Nuevo filtro
  const [currentPage, setCurrentPage] = useState(1);
  const maxMatchesPerPage = 20;

  // Función para determinar si un anunciante es propio o competencia
  const isPropio = (anunciante: string): boolean => {
    const anuncianteLower = anunciante.toLowerCase();
    return anuncianteLower.includes('jbc') || 
           anuncianteLower.includes('j.b.c') || 
           anuncianteLower.includes('picó blanes') || 
           anuncianteLower.includes('pico blanes');
  };

  // Filtrar matches
  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      // Filtro por término de búsqueda
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          match.client_name.toLowerCase().includes(term) ||
          match.zona.toLowerCase().includes(term) ||
          match.anunciante.toLowerCase().includes(term) ||
          match.tipo.toLowerCase().includes(term);
        
        if (!matchesSearch) return false;
      }

      // Filtro por cliente específico
      if (selectedClient !== 'all' && match.client_id !== selectedClient) {
        return false;
      }

      // Filtro por operación
      if (operationFilter !== 'all' && match.operacion !== operationFilter) {
        return false;
      }

      // Filtro por score
      if (scoreFilter !== 'all') {
        if (scoreFilter === 'high' && match.score < 0.8) return false;
        if (scoreFilter === 'medium' && (match.score < 0.6 || match.score >= 0.8)) return false;
        if (scoreFilter === 'low' && match.score >= 0.6) return false;
      }

      // Filtro por anunciante (Propio/Competencia)
      if (anuncianteFilter !== 'all') {
        const esPropio = isPropio(match.anunciante);
        if (anuncianteFilter === 'propio' && !esPropio) return false;
        if (anuncianteFilter === 'competencia' && esPropio) return false;
      }

      return true;
    });
  }, [matches, searchTerm, selectedClient, operationFilter, scoreFilter, anuncianteFilter]);

  // Paginación
  const totalPages = Math.ceil(filteredMatches.length / maxMatchesPerPage);
  const startIndex = (currentPage - 1) * maxMatchesPerPage;
  const endIndex = startIndex + maxMatchesPerPage;
  const currentMatches = filteredMatches.slice(startIndex, endIndex);

  // Reset página cuando cambian los filtros
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClient, operationFilter, scoreFilter, anuncianteFilter]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
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

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
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

  // Estadísticas de matches
  const stats = useMemo(() => {
    const totalMatches = filteredMatches.length;
    const highScoreMatches = filteredMatches.filter(m => m.score >= 0.8).length;
    const mediumScoreMatches = filteredMatches.filter(m => m.score >= 0.6 && m.score < 0.8).length;
    const lowScoreMatches = filteredMatches.filter(m => m.score < 0.6).length;
    const uniqueClients = new Set(filteredMatches.map(m => m.client_id)).size;
    const propioMatches = filteredMatches.filter(m => isPropio(m.anunciante)).length;
    const competenciaMatches = filteredMatches.filter(m => !isPropio(m.anunciante)).length;
    
    return {
      totalMatches,
      highScoreMatches,
      mediumScoreMatches,
      lowScoreMatches,
      uniqueClients,
      propioMatches,
      competenciaMatches
    };
  }, [filteredMatches]);

  // Obtener lista única de clientes para el selector
  const uniqueClients = useMemo(() => {
    const clientMap = new Map();
    matches.forEach(match => {
      if (!clientMap.has(match.client_id)) {
        clientMap.set(match.client_id, match.client_name);
      }
    });
    return Array.from(clientMap.entries()).map(([id, name]) => ({ id, name }));
  }, [matches]);

  if (!matches.length) {
    return (
      <Card className="border-dashed">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
            <Target className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No hay matches disponibles</h3>
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
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMatches}</div>
            <p className="text-xs text-muted-foreground">
              {stats.uniqueClients} clientes únicos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matches de Alta Calidad</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.highScoreMatches}</div>
            <p className="text-xs text-muted-foreground">
              Score ≥ 80%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propiedades Propias</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.propioMatches}</div>
            <p className="text-xs text-muted-foreground">
              JBC / Picó Blanes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competencia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.competenciaMatches}</div>
            <p className="text-xs text-muted-foreground">
              Otras inmobiliarias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filtros de Matches
          </CardTitle>
          <CardDescription>
            Filtra las coincidencias por cliente, operación, calidad y tipo de anunciante
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Búsqueda por texto */}
            <div className="space-y-2">
              <Label htmlFor="match-search">Buscar</Label>
              <Input
                id="match-search"
                placeholder="Cliente, zona, anunciante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtro por cliente */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {uniqueClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por operación */}
            <div className="space-y-2">
              <Label>Operación</Label>
              <Select value={operationFilter} onValueChange={setOperationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las operaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las operaciones</SelectItem>
                  <SelectItem value="Venta">Venta</SelectItem>
                  <SelectItem value="Alquiler">Alquiler</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por score */}
            <div className="space-y-2">
              <Label>Calidad del Match</Label>
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los scores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los scores</SelectItem>
                  <SelectItem value="high">Alta (≥80%)</SelectItem>
                  <SelectItem value="medium">Media (60-79%)</SelectItem>
                  <SelectItem value="low">Baja (&lt;60%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nuevo filtro por tipo de anunciante */}
            <div className="space-y-2">
              <Label>Tipo de Anunciante</Label>
              <Select value={anuncianteFilter} onValueChange={setAnuncianteFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="propio">Propio (JBC)</SelectItem>
                  <SelectItem value="competencia">Competencia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botón limpiar filtros */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedClient('all');
                  setOperationFilter('all');
                  setScoreFilter('all');
                  setAnuncianteFilter('all');
                }}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>

          {/* Resumen de filtros activos */}
          {(searchTerm || selectedClient !== 'all' || operationFilter !== 'all' || scoreFilter !== 'all' || anuncianteFilter !== 'all') && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros activos</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchTerm && (
                  <Badge variant="outline">Búsqueda: "{searchTerm}"</Badge>
                )}
                {selectedClient !== 'all' && (
                  <Badge variant="outline">
                    Cliente: {uniqueClients.find(c => c.id === selectedClient)?.name}
                  </Badge>
                )}
                {operationFilter !== 'all' && (
                  <Badge variant="outline">Operación: {operationFilter}</Badge>
                )}
                {scoreFilter !== 'all' && (
                  <Badge variant="outline">
                    Score: {scoreFilter === 'high' ? 'Alto' : scoreFilter === 'medium' ? 'Medio' : 'Bajo'}
                  </Badge>
                )}
                {anuncianteFilter !== 'all' && (
                  <Badge variant="outline">
                    Anunciante: {anuncianteFilter === 'propio' ? 'Propio (JBC)' : 'Competencia'}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controles de paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} • Mostrando {startIndex + 1}-{Math.min(endIndex, filteredMatches.length)} de {filteredMatches.length} matches
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

      {/* Tabla de Matches */}
      <Card>
        <CardHeader>
          <CardTitle>Matches Cliente-Propiedad</CardTitle>
          <CardDescription>
            Coincidencias ordenadas por relevancia y calidad del match
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Anunciante</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Operación</TableHead>
                  <TableHead>Características</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentMatches.map((match, index) => (
                  <TableRow key={`${match.client_id}-${match.property_id}-${index}`}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{match.client_name}</div>
                        <div className="text-xs text-muted-foreground">ID: {match.client_id}</div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{match.tipo}</div>
                        <div className="text-xs text-muted-foreground">ID: {match.property_id}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{match.anunciante}</div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${isPropio(match.anunciante) 
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' 
                            : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800'
                          }`}
                        >
                          {isPropio(match.anunciante) ? 'Propio' : 'Competencia'}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{match.zona}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge className={`text-xs px-2 py-1 ${getOperationStyle(match.operacion)}`}>
                        {match.operacion}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <Filter className="h-3 w-3 text-muted-foreground" />
                          <span>{match.habitaciones}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Bath className="h-3 w-3 text-muted-foreground" />
                          <span>{match.banos}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Square className="h-3 w-3 text-muted-foreground" />
                          <span>{match.m2}m²</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Euro className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{formatPrice(match.precio)}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={`text-xs px-2 py-1 ${getScoreColor(match.score)}`}>
                          {(match.score * 100).toFixed(0)}%
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Rank: #{match.rank_client}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(match.link_inmueble, '_blank')}
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}