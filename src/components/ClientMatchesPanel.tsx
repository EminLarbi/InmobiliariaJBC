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
import { ExternalLink, User, Chrome as Home, Bath, Square, MapPin, Euro, Star, TrendingUp, Users, Target, Search } from 'lucide-react';

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
}

export function ClientMatchesPanel({ properties, matches }: ClientMatchesPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClient, setExpandedClient] = useState<string>('');

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
        acc[clientKey] = {
          client_id: match.client_id,
          client_name: match.client_name,
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
  }, [filteredMatches]);

  // Memoizar cálculos pesados
  const stats = useMemo(() => {
    const clientList = Object.values(clientGroups);
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
  }, [clientGroups, filteredMatches]);
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
            {Object.values(clientGroups).map((client) => (
              <AccordionItem key={client.client_id} value={client.client_id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{client.client_name}</p>
                        <p className="text-sm text-muted-foreground">ID: {client.client_id}</p>
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