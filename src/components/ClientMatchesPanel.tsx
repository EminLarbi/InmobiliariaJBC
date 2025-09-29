import React, { useMemo } from 'react';
import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Separator } from './ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { MultiSelect } from './MultiSelect';
import { Property, ClientMatch } from './PropertyTable';
import { ExternalLink, User, Bed, Bath, Square, MapPin, Euro, Star, TrendingUp, Users, Target, Search, Phone, Mail, Calendar, ListFilter as Filter, SlidersHorizontal, Chrome as Home, ShoppingCart } from 'lucide-react'rt } from 'lucide-react';

interface MatchFilters {
  searchTerm: string;
  minScore: number;
  maxScore: number;
  operaciones: string[];
  zonas: string[];
  anunciantes: string[];
  minPrecio: string;
  maxPrecio: string;
  minHabitaciones: string;
  maxHabitaciones: string;
  minBanos: string;
  maxBanos: string;
  minM2: string;
  maxM2: string;
  sortBy: 'score' | 'precio' | 'habitaciones' | 'rank' | 'client_name';
  sortDirection: 'asc' | 'desc';
}

interface ClientInfo {
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
  clients?: ClientInfo[];
}

export function ClientMatchesPanel({ properties, matches, clients }: ClientMatchesPanelProps) {
  const [expandedClient, setExpandedClient] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<MatchFilters>({
    searchTerm: '',
    minScore: 0,
    maxScore: 100,
    operaciones: [],
    zonas: [],
    anunciantes: [],
    minPrecio: '',
    maxPrecio: '',
    minHabitaciones: '',
    maxHabitaciones: '',
    minBanos: '',
    maxBanos: '',
    minM2: '',
    maxM2: '',
    sortBy: 'score',
    sortDirection: 'desc'
  });
  const [scoreRange, setScoreRange] = useState<number[]>([0, 100]);
  const maxClientsPerPage = 30;

  // Obtener opciones únicas para filtros
  const filterOptions = useMemo(() => {
    const operaciones = [...new Set(matches.map(m => m.operacion).filter(Boolean))].sort();
    const zonas = [...new Set(matches.map(m => {
      const zona = m.zona.split(',')[0].trim().replace(/^\('?/, '').replace(/'$/, '');
      return zona;
    }).filter(Boolean))].sort();
    const anunciantes = [...new Set(matches.map(m => m.anunciante).filter(Boolean))].sort();
    
    return { operaciones, zonas, anunciantes };
  }, [matches]);

  // Aplicar todos los filtros
  const filteredMatches = useMemo(() => {
    let filtered = matches;
    
    // Filtro por término de búsqueda
    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(match => 
        match.client_name.toLowerCase().includes(term) ||
        match.zona.toLowerCase().includes(term) ||
        match.anunciante.toLowerCase().includes(term)
      );
    }
    
    // Filtro por score
    filtered = filtered.filter(match => {
      const scorePercent = match.score * 100;
      return scorePercent >= filters.minScore && scorePercent <= filters.maxScore;
    });
    
    // Filtro por operaciones
    if (filters.operaciones.length > 0) {
      filtered = filtered.filter(match => 
        filters.operaciones.includes(match.operacion)
      );
    }
    
    // Filtro por zonas
    if (filters.zonas.length > 0) {
      filtered = filtered.filter(match => {
        const zona = match.zona.split(',')[0].trim().replace(/^\('?/, '').replace(/'$/, '');
        return filters.zonas.includes(zona);
      });
    }
    
    // Filtro por anunciantes
    if (filters.anunciantes.length > 0) {
      filtered = filtered.filter(match => 
        filters.anunciantes.includes(match.anunciante)
      );
    }
    
    // Filtro por precio
    if (filters.minPrecio) {
      filtered = filtered.filter(match => match.precio >= parseInt(filters.minPrecio));
    }
    if (filters.maxPrecio) {
      filtered = filtered.filter(match => match.precio <= parseInt(filters.maxPrecio));
    }
    
    // Filtro por habitaciones
    if (filters.minHabitaciones) {
      filtered = filtered.filter(match => match.habitaciones >= parseInt(filters.minHabitaciones));
    }
    if (filters.maxHabitaciones) {
      filtered = filtered.filter(match => match.habitaciones <= parseInt(filters.maxHabitaciones));
    }
    
    // Filtro por baños
    if (filters.minBanos) {
      filtered = filtered.filter(match => match.banos >= parseInt(filters.minBanos));
    }
    if (filters.maxBanos) {
      filtered = filtered.filter(match => match.banos <= parseInt(filters.maxBanos));
    }
    
    // Filtro por m²
    if (filters.minM2) {
      filtered = filtered.filter(match => match.m2 >= parseInt(filters.minM2));
    }
    if (filters.maxM2) {
      filtered = filtered.filter(match => match.m2 <= parseInt(filters.maxM2));
    }
    
    return filtered;
  }, [matches, filters]);

  // Ordenar matches
  const sortedMatches = useMemo(() => {
    return [...filteredMatches].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filters.sortBy) {
        case 'score':
          aValue = a.score;
          bValue = b.score;
          break;
        case 'precio':
          aValue = a.precio;
          bValue = b.precio;
          break;
        case 'habitaciones':
          aValue = a.habitaciones;
          bValue = b.habitaciones;
          break;
        case 'rank':
          aValue = a.rank_client;
          bValue = b.rank_client;
          break;
        case 'client_name':
          aValue = a.client_name.toLowerCase();
          bValue = b.client_name.toLowerCase();
          break;
        default:
          aValue = a.score;
          bValue = b.score;
      }
      
      if (filters.sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [filteredMatches, filters.sortBy, filters.sortDirection]);

  const handleFilterChange = (key: keyof MatchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleScoreRangeChange = (values: number[]) => {
    setScoreRange(values);
    setFilters(prev => ({
      ...prev,
      minScore: values[0],
      maxScore: values[1]
    }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      minScore: 0,
      maxScore: 100,
      operaciones: [],
      zonas: [],
      anunciantes: [],
      minPrecio: '',
      maxPrecio: '',
      minHabitaciones: '',
      maxHabitaciones: '',
      minBanos: '',
      maxBanos: '',
      minM2: '',
      maxM2: '',
      sortBy: 'score',
      sortDirection: 'desc'
    });
    setScoreRange([0, 100]);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.minScore > 0 || filters.maxScore < 100) count++;
    if (filters.operaciones.length > 0) count++;
    if (filters.zonas.length > 0) count++;
    if (filters.anunciantes.length > 0) count++;
    if (filters.minPrecio || filters.maxPrecio) count++;
    if (filters.minHabitaciones || filters.maxHabitaciones) count++;
    if (filters.minBanos || filters.maxBanos) count++;
    if (filters.minM2 || filters.maxM2) count++;
    return count;
  };

  // Agrupar matches filtrados y ordenados por cliente
  const clientGroups = useMemo(() => {
    if (!sortedMatches.length) return {};
    
    // Agrupar matches filtrados por cliente
    const groups = sortedMatches.reduce((acc, match) => {
      const clientKey = match.client_id || match.client_name;
      if (!acc[clientKey]) {
        // Buscar información completa del cliente
        const clientInfo = clients?.find(c => c.id === match.client_id);
        
        acc[clientKey] = {
          client_id: match.client_id,
          client_name: match.client_name,
          client_info: clientInfo as ClientInfo || {
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
          } as ClientInfo,
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
  }, [sortedMatches, clients]);
  
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
  }, [filters]);

  // Memoizar cálculos pesados
  const stats = useMemo(() => {
    const totalClients = clientList.length;
    const totalMatches = sortedMatches.length;
    const avgMatchesPerClient = totalClients > 0 ? totalMatches / totalClients : 0;
    const highQualityMatches = sortedMatches.filter(m => m.score >= 0.8).length;
    
    return {
      totalClients,
      totalMatches,
      avgMatchesPerClient,
      highQualityMatches
    };
  }, [clientList, sortedMatches]);

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
            <CardTitle className="text-sm font-medium">Total clientes</CardTitle>
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
            <CardTitle className="text-sm font-medium">Total matches</CardTitle>
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
            <CardTitle className="text-sm font-medium">Promedio por cliente</CardTitle>
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
            <CardTitle className="text-sm font-medium">Matches de alta calidad</CardTitle>
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

      {/* Panel de Filtros Avanzados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                Filtros de matches
              </CardTitle>
              <CardDescription>
                Filtra y ordena las coincidencias entre clientes y propiedades
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary">
                  {getActiveFiltersCount()} filtro{getActiveFiltersCount() !== 1 ? 's' : ''}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Búsqueda y ordenamiento */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client-search">Buscar por nombre, zona o anunciante</Label>
                <Input
                  id="client-search"
                  placeholder="Escribe para filtrar..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Ordenar por</Label>
                <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Score de coincidencia</SelectItem>
                    <SelectItem value="precio">Precio</SelectItem>
                    <SelectItem value="habitaciones">Habitaciones</SelectItem>
                    <SelectItem value="rank">Ranking del cliente</SelectItem>
                    <SelectItem value="client_name">Nombre del cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Select value={filters.sortDirection} onValueChange={(value) => handleFilterChange('sortDirection', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descendente</SelectItem>
                    <SelectItem value="asc">Ascendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Filtro por Score */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                <Label>Score de coincidencia</Label>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{scoreRange[0]}%</span>
                  <span>{scoreRange[1]}%</span>
                </div>
                <Slider
                  value={scoreRange}
                  onValueChange={handleScoreRangeChange}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>
            </div>

            <Separator />

            {/* Filtros por categorías */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <Label>Filtros por categorías</Label>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Tipo de operación</Label>
                  <MultiSelect
                    options={filterOptions.operaciones}
                    selected={filters.operaciones}
                    onSelectionChange={(selected) => handleFilterChange('operaciones', selected)}
                    placeholder="Todas las operaciones..."
                    searchPlaceholder="Buscar operación..."
                    emptyText="No se encontraron operaciones"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Zonas</Label>
                  <MultiSelect
                    options={filterOptions.zonas}
                    selected={filters.zonas}
                    onSelectionChange={(selected) => handleFilterChange('zonas', selected)}
                    placeholder="Todas las zonas..."
                    searchPlaceholder="Buscar zona..."
                    emptyText="No se encontraron zonas"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Anunciantes</Label>
                  <MultiSelect
                    options={filterOptions.anunciantes}
                    selected={filters.anunciantes}
                    onSelectionChange={(selected) => handleFilterChange('anunciantes', selected)}
                    placeholder="Todos los anunciantes..."
                    searchPlaceholder="Buscar anunciante..."
                    emptyText="No se encontraron anunciantes"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Filtros numéricos */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                <Label>Filtros por características</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Precio */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Precio (€)</Label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={filters.minPrecio}
                      onChange={(e) => handleFilterChange('minPrecio', e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={filters.maxPrecio}
                      onChange={(e) => handleFilterChange('maxPrecio', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                
                {/* Habitaciones */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Habitaciones</Label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={filters.minHabitaciones}
                      onChange={(e) => handleFilterChange('minHabitaciones', e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={filters.maxHabitaciones}
                      onChange={(e) => handleFilterChange('maxHabitaciones', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                
                {/* Baños */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Baños</Label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={filters.minBanos}
                      onChange={(e) => handleFilterChange('minBanos', e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={filters.maxBanos}
                      onChange={(e) => handleFilterChange('maxBanos', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                
                {/* Metros cuadrados */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Superficie (m²)</Label>
                  <div className="grid grid-cols-2 gap-1">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={filters.minM2}
                      onChange={(e) => handleFilterChange('minM2', e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={filters.maxM2}
                      onChange={(e) => handleFilterChange('maxM2', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen de filtros activos */}
            {getActiveFiltersCount() > 0 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtros aplicados</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Mostrando {stats.totalMatches} matches de {stats.totalClients} clientes
                  {filters.minScore > 0 || filters.maxScore < 100 ? ` con score entre ${filters.minScore}%-${filters.maxScore}%` : ''}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información adicional de filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Resultados de búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Input
              id="client-search"
              placeholder="Escribe para filtrar clientes..."
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="max-w-md"
            />
            {filters.searchTerm && (
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
            Matches por cliente
          </CardTitle>
          <CardDescription>
            Propiedades recomendadas para cada cliente ordenadas por relevancia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" value={expandedClient} onValueChange={setExpandedClient}>
            {currentClients.map((client) => (
              <AccordionItem key={client.client_id} value={client.client_id}>
                <AccordionTrigger 
                  className="hover:no-underline"
                  aria-label={`${expandedClient === client.client_id ? 'Contraer' : 'Expandir'} información de ${client.client_name} con ${client.matches.length} propiedades coincidentes`}
                >
                  <div className="flex items-center justify-between w-full mr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center" aria-hidden="true">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{client.client_name.toUpperCase()}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>ID: {client.client_id}</span>
                          {client.client_info?.telefono && (
                            <span>• {client.client_info.telefono}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" aria-label={`${client.matches.length} propiedades coincidentes`}>
                        {client.matches.length} propiedades
                      </Badge>
                      {client.matches.some(m => m.score >= 0.8) && (
                        <Badge 
                          className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                          aria-label="Cliente con matches de alta calidad"
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Alta calidad
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div 
                    className="space-y-4 pt-4" 
                    key={`content-${client.client_id}`}
                    role="region"
                    aria-label={`Detalles de ${client.client_name} y propiedades recomendadas`}
                  >
                    
                    {/* Información del cliente */}
                    {client.client_info && (
                      <Card className="bg-muted/30">
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            Perfil del cliente
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Información de contacto */}
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Información de contacto</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">Nombre:</span>
                                  <span className="font-medium">{client.client_info.nombre || client.client_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">ID:</span>
                                  <span className="font-mono text-xs bg-muted px-1 rounded">{client.client_info.id}</span>
                                </div>
                                {client.client_info.telefono && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Teléfono:</span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">{client.client_info.telefono}</span>
                                  </div>
                                )}
                                {client.client_info.mail && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Email:</span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400 truncate">{client.client_info.mail}</span>
                                  </div>
                                )}
                                {client.client_info.fecha_inclusion && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Registrado:</span>
                                    <span className="font-medium">{client.client_info.fecha_inclusion}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Requisitos */}
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Requisitos de búsqueda</h5>
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
                                    <span className="text-muted-foreground">Tipos de propiedad:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {client.client_info.types.map((type, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-200">
                                          {type}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {client.client_info.conditions && client.client_info.conditions.length > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Condiciones:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {client.client_info.conditions.map((condition, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/20 dark:border-purple-800 dark:text-purple-200">
                                          {condition}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {(client.client_info.rooms_min || client.client_info.rooms_max) && (
                                  <div className="flex items-center gap-2">
                                    <Bed className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Habitaciones:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">{formatRange(client.client_info.rooms_min, client.client_info.rooms_max)}</span>
                                  </div>
                                )}
                                
                                {(client.client_info.bath_min || client.client_info.bath_max) && (
                                  <div className="flex items-center gap-2">
                                    <Bath className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Baños:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">{formatRange(client.client_info.bath_min, client.client_info.bath_max)}</span>
                                  </div>
                                )}
                                
                                {(client.client_info.area_min_m2 || client.client_info.area_max_m2) && (
                                  <div className="flex items-center gap-2">
                                    <Square className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Superficie:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">{formatRange(client.client_info.area_min_m2, client.client_info.area_max_m2, ' m²')}</span>
                                  </div>
                                )}
                                
                                {(client.client_info.price_min_eur || client.client_info.price_max_eur) && (
                                  <div className="flex items-center gap-2">
                                    <Euro className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Presupuesto:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">
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
                                    <Bed className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Salones:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">{formatRange(client.client_info.living_min, client.client_info.living_max)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Información adicional */}
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium text-muted-foreground">Detalles adicionales</h5>
                              <div className="space-y-1 text-sm">
                                {client.client_info.creado_info && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">Registrado por:</span>
                                    </div>
                                    <p className="text-xs bg-blue-50 dark:bg-blue-950/20 p-2 rounded border-l-2 border-blue-300 dark:border-blue-700 font-medium">
                                      {client.client_info.creado_info.replace(/,$/, '')}
                                    </p>
                                  </div>
                                )}
                                
                                {client.client_info.flags && client.client_info.flags.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <Star className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">Características especiales:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {client.client_info.flags.map((flag, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-200">
                                          {flag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {client.client_info.locations && client.client_info.locations.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">Zonas de interés:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {client.client_info.locations.map((location, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-950/20 dark:border-indigo-800 dark:text-indigo-200">
                                          {location}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {client.client_info.zona_std && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Zona estándar:</span>
                                    <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-950/20 dark:border-slate-800 dark:text-slate-200">
                                      {client.client_info.zona_std}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Propiedades recomendadas */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Propiedades recomendadas
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Total: {client.matches.length}</span>
                          <span>•</span>
                          <span>Mejor score: {formatScore(Math.max(...client.matches.map(m => m.score)))}%</span>
                          <span>•</span>
                          <span>Alta calidad: {client.matches.filter(m => m.score >= 0.8).length}</span>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {client.matches.map((match, idx) => {
                          const property = properties.find(p => p.link_inmueble === match.property_link);
                          return (
                            <Card key={`${match.property_link}-${idx}`} className="border-l-4 border-l-primary/20">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Badge className={`text-xs px-2 py-1 ${getScoreColor(match.score)}`}>
                                        Score: {formatScore(match.score)}%
                                      </Badge>
                                      <Badge className={`text-xs px-2 py-1 ${getOperationStyle(match.operacion)}`}>
                                        {match.operacion?.toUpperCase()}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        Rank: #{match.rank_client}
                                      </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                      <div className="flex items-center gap-1">
                                        <Bed className="h-3 w-3 text-muted-foreground" />
                                        <span>{property?.habitaciones || match.habitaciones} hab.</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Bath className="h-3 w-3 text-muted-foreground" />
                                        <span>{property?.baños || match.baños} baños</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Square className="h-3 w-3 text-muted-foreground" />
                                        <span>{property?.metros_cuadrados || match.metros_cuadrados} m²</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Euro className="h-3 w-3 text-muted-foreground" />
                                        <span className="font-medium text-green-600 dark:text-green-400">
                                          {formatPrice(property?.precio || match.precio)}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-sm">
                                      <MapPin className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">{match.zona.split(',')[0].trim().replace(/^\('?/, '').replace(/'$/, '')}</span>
                                      <span className="text-muted-foreground">•</span>
                                      <span className="font-medium">{match.anunciante?.toUpperCase()}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(match.property_link, '_blank')}
                                      className="flex items-center gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Ver
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
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