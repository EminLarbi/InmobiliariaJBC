import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Database, 
  BarChart3, 
  Users, 
  Home as HomeIcon,
  TrendingUp,
  Target,
  ArrowRight,
  Building2,
  MapPin,
  Euro,
  Calendar,
  Star
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (tabValue: string) => void;
  propertiesCount: number;
  matchesCount: number;
}

export function HomePage({ onNavigate, propertiesCount, matchesCount }: HomePageProps) {
  const panels = [
    {
      id: 'search',
      title: 'Buscar Propiedades',
      description: 'Explora y filtra el inventario completo de propiedades inmobiliarias',
      icon: Database,
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600',
      features: ['Filtros avanzados', 'Vista de tarjetas y lista', 'Exportación de datos'],
      stats: `${propertiesCount} propiedades`,
      action: 'Explorar propiedades'
    },
    {
      id: 'analytics',
      title: 'Análisis de Mercado',
      description: 'Insights profundos y tendencias del mercado inmobiliario local',
      icon: BarChart3,
      color: 'bg-emerald-500',
      gradient: 'from-emerald-500 to-emerald-600',
      features: ['Análisis por zonas', 'Tendencias de precios', 'Competencia'],
      stats: 'Datos en tiempo real',
      action: 'Ver análisis'
    },
    {
      id: 'matches',
      title: 'Matches de Clientes',
      description: 'Coincidencias inteligentes entre clientes y propiedades disponibles',
      icon: Users,
      color: 'bg-purple-500',
      gradient: 'from-purple-500 to-purple-600',
      features: ['Scoring automático', 'Recomendaciones', 'Gestión de leads'],
      stats: `${matchesCount} matches activos`,
      action: 'Gestionar matches'
    }
  ];

  const quickStats = [
    {
      label: 'Propiedades Totales',
      value: propertiesCount.toLocaleString('es-ES'),
      icon: Building2,
      color: 'text-blue-600'
    },
    {
      label: 'Zonas Cubiertas',
      value: '15+',
      icon: MapPin,
      color: 'text-emerald-600'
    },
    {
      label: 'Valor Promedio',
      value: '€350K',
      icon: Euro,
      color: 'text-purple-600'
    },
    {
      label: 'Actualizado',
      value: 'Hoy',
      icon: Calendar,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mb-6">
          <HomeIcon className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Inmobiliaria JBC
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Plataforma integral de gestión inmobiliaria con análisis avanzado de mercado y matching inteligente de clientes
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="text-center">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <IconComponent className={`h-8 w-8 mx-auto ${stat.color}`} />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Panels */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Herramientas Principales</h2>
          <p className="text-muted-foreground">
            Accede a todas las funcionalidades de la plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {panels.map((panel) => {
            const IconComponent = panel.icon;
            return (
              <Card 
                key={panel.id} 
                className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 hover:scale-[1.02]"
                onClick={() => onNavigate(panel.id)}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${panel.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {panel.stats}
                    </Badge>
                  </div>
                  
                  <div>
                    <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                      {panel.title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {panel.description}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Features List */}
                  <div className="space-y-2">
                    {panel.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <Button 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(panel.id);
                    }}
                  >
                    {panel.action}
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Additional Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Star className="h-5 w-5" />
              Zonas Estratégicas
            </CardTitle>
            <CardDescription>
              Análisis especializado en zonas de alto potencial
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Identifica oportunidades de inversión en barrios emergentes y zonas consolidadas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <TrendingUp className="h-5 w-5" />
              Inteligencia de Mercado
            </CardTitle>
            <CardDescription>
              Datos actualizados y tendencias del sector
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-700 dark:text-green-300">
              Mantente al día con las fluctuaciones del mercado y toma decisiones informadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-border/50">
        <p className="text-sm text-muted-foreground">
          Plataforma desarrollada para optimizar la gestión inmobiliaria
        </p>
      </div>
    </div>
  );
}