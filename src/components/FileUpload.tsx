import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Property } from './PropertyTable';

interface FileUploadProps {
  onDataLoaded: (properties: Property[]) => void;
}

export function FileUpload({ onDataLoaded }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const parseCSV = (text: string): Property[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('El archivo CSV debe contener al menos una fila de encabezados y una fila de datos');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Mapeo de posibles nombres de columnas
    const columnMap: Record<string, string[]> = {
      habitaciones: ['habitaciones', 'rooms', 'bedrooms'],
      baños: ['baños', 'banos', 'bathrooms', 'baths'],
      precio: ['precio', 'price', 'cost'],
      link_inmueble: ['link_inmueble', 'link', 'url', 'enlace'],
      metros_cuadrados: ['metros_cuadrados', 'metros', 'm2', 'sqm', 'square_meters'],
      anunciante: ['anunciante', 'advertiser', 'agency', 'agencia'],
      zona: ['zona', 'zone', 'area', 'location', 'ubicacion'],
      web: ['web', 'website', 'portal', 'site'],
      fecha_inclusion: ['fecha_inclusion', 'fecha', 'date', 'created_at'],
      tipo_de_operacion: ['tipo_de_operacion', 'tipo_operacion', 'operacion', 'operation_type', 'type']
    };

    // Encontrar índices de columnas
    const columnIndices: Record<string, number> = {};
    Object.keys(columnMap).forEach(key => {
      const index = headers.findIndex(header => 
        columnMap[key].some(alias => header.includes(alias))
      );
      if (index !== -1) {
        columnIndices[key] = index;
      }
    });

    // Verificar campos requeridos
    const requiredFields = ['habitaciones', 'baños', 'precio', 'metros_cuadrados', 'zona'];
    const missingFields = requiredFields.filter(field => columnIndices[field] === undefined);
    
    if (missingFields.length > 0) {
      throw new Error(`Faltan columnas requeridas: ${missingFields.join(', ')}`);
    }

    const properties: Property[] = [];
    
    // Utilidad para convertir a float con separadores locales
    const toFloat = (v: string) => {
      if (!v) return 0;
      let s = String(v).trim();
      s = s.replace(/[€$]/g, '').replace(/\s+/g, '');
      const hasComma = s.includes(',');
      const hasDot = s.includes('.');
      if (hasComma && hasDot) {
        s = s.replace(/\./g, '');
        s = s.replace(/,/g, '.');
      } else if (hasComma && !hasDot) {
        s = s.replace(/,/g, '.');
      }
      s = s.replace(/[^0-9.-]/g, '');
      const num = parseFloat(s);
      return isNaN(num) ? 0 : num;
    };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length < headers.length) continue;

      try {
        // Función para normalizar el tipo de operación
        const normalizeTipoOperacion = (tipo: string): 'Venta' | 'Alquiler' | 'Otro' => {
          const tipoLower = tipo.toLowerCase().trim();
          if (tipoLower.includes('venta') || tipoLower.includes('compra') || tipoLower.includes('sale')) {
            return 'Venta';
          } else if (tipoLower.includes('alquiler') || tipoLower.includes('rent') || tipoLower.includes('rental')) {
            return 'Alquiler';
          } else {
            return 'Otro';
          }
        };

        const property: Property = {
          id: i,
          habitaciones: parseInt(values[columnIndices.habitaciones]) || 0,
          baños: parseInt(values[columnIndices.baños]) || 0,
          precio: toFloat(values[columnIndices.precio]) || 0,
          link_inmueble: values[columnIndices.link_inmueble] || '#',
          metros_cuadrados: toFloat(values[columnIndices.metros_cuadrados]) || 0,
          anunciante: values[columnIndices.anunciante] || 'Sin especificar',
          zona: values[columnIndices.zona] || 'Sin especificar',
          web: values[columnIndices.web] || 'Sin especificar',
          fecha_inclusion: values[columnIndices.fecha_inclusion] || new Date().toISOString().split('T')[0],
          tipo_de_operacion: columnIndices.tipo_de_operacion !== undefined 
            ? normalizeTipoOperacion(values[columnIndices.tipo_de_operacion])
            : 'Otro'
        };

        if (property.habitaciones > 0 && property.precio > 0 && property.metros_cuadrados > 0) {
          properties.push(property);
        }
      } catch (err) {
        console.warn(`Error procesando fila ${i + 1}:`, err);
      }
    }

    if (properties.length === 0) {
      throw new Error('No se pudieron procesar propiedades válidas del archivo');
    }

    return properties;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Por favor, selecciona un archivo CSV válido');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const text = await file.text();
      const properties = parseCSV(text);
      
      onDataLoaded(properties);
      setSuccess(`¡Archivo cargado exitosamente! Se procesaron ${properties.length} propiedades.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
    } finally {
      setIsLoading(false);
      // Limpiar el input para permitir cargar el mismo archivo nuevamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Card className="p-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        
        <div>
          <h3 className="mb-2">Cargar Archivo CSV</h3>
          <p className="text-muted-foreground text-sm">
            Sube tu archivo CSV con datos inmobiliarios para filtrar y analizar
          </p>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={handleFileSelect} 
            disabled={isLoading}
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            {isLoading ? 'Procesando...' : 'Seleccionar Archivo CSV'}
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="text-left">
          <p className="text-sm text-muted-foreground mb-2">Columnas requeridas:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <strong>habitaciones</strong> - Número de habitaciones</li>
            <li>• <strong>baños</strong> - Número de baños</li>
            <li>• <strong>precio</strong> - Precio de la propiedad</li>
            <li>• <strong>metros_cuadrados</strong> - Superficie en m²</li>
            <li>• <strong>zona</strong> - Zona o ubicación</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Columnas opcionales: tipo_de_operacion, anunciante, web, link_inmueble, fecha_inclusion
          </p>
        </div>
      </div>
    </Card>
  );
}
