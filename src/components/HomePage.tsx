import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Database, ChartBar as BarChart3, Users, ArrowRight, Building2 } from 'lucide-react';

interface HomePageProps {
  onNavigate: (tabValue: string) => void;
  propertiesCount: number;
  matchesCount: number;
}

export function HomePage({ onNavigate, propertiesCount, matchesCount }: HomePageProps) {
  const sections = [
    {
      id: 'search',
      title: 'Buscar Propiedades',
      description: 'Explora y filtra el inventario completo de propiedades inmobiliarias',
      icon: Database,
      color: 'bg-blue-500',
      stats: `${propertiesCount} propiedades`
    },
    {
      id: 'analytics',
      title: 'Análisis de Mercado',
      description: 'Insights y tendencias del mercado inmobiliario local',
      icon: BarChart3,
      color: 'bg-emerald-500',
      stats: 'Datos en tiempo real'
    },
    {
      id: 'matches',
      title: 'Matches de Clientes',
      description: 'Coincidencias entre clientes y propiedades disponibles',
      icon: Users,
      color: 'bg-purple-500',
      stats: `${matchesCount} matches activos`
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">
            Inmobiliaria JBC
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Plataforma integral de gestión inmobiliaria
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {sections.map((section) => {
            const IconComponent = section.icon;
            return (
              <Card 
                key={section.id} 
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
                onClick={() => onNavigate(section.id)}
              >
                <CardHeader className="text-center space-y-4">
                  <div className={`w-16 h-16 rounded-xl ${section.color} flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  
                  <div>
                    <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                      {section.title}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {section.description}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="text-center">
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">{section.stats}</p>
                  </div>

                  <Button 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(section.id);
                    }}
                  >
                    Acceder
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Selecciona una sección para comenzar
          </p>
        </div>
      </div>
    </div>
  );
}