// FILE: src/components/authority/sections/NhtsaSection.tsx
// NHTSA (Vehicles) authority data display
// v7.5 - Bulletproof data extraction for VIN lookups

'use client';

import React from 'react';
import { ExternalLink, Car, Gauge, Fuel, Settings, Calendar, MapPin, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

export const NhtsaSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract vehicle-specific fields
  const thumbnail = getThumbnailUrl(data);
  const vin = get<string>('vin') || get<string>('VIN');
  const make = get<string>('make') || get<string>('Make');
  const model = get<string>('model') || get<string>('Model');
  const year = get<number>('vehicleYear') || get<number>('year') || get<number>('ModelYear');
  const trim = get<string>('trim') || get<string>('Trim');
  const series = get<string>('series') || get<string>('Series');
  const bodyClass = get<string>('bodyClass') || get<string>('BodyClass');
  const vehicleType = get<string>('vehicleType') || get<string>('VehicleType');
  const driveType = get<string>('driveType') || get<string>('DriveType');
  const fuelType = get<string>('fuelType') || get<string>('FuelTypePrimary');
  const fuelTypeSecondary = get<string>('fuelTypeSecondary') || get<string>('FuelTypeSecondary');
  
  // Engine specs
  const engineCylinders = get<number>('engineCylinders') || get<number>('EngineCylinders');
  const engineDisplacement = get<string>('engineDisplacement') || get<string>('DisplacementL');
  const engineHP = get<number>('engineHP') || get<number>('EngineHP');
  const engineKW = get<number>('engineKW') || get<number>('EngineKW');
  const engineModel = get<string>('engineModel') || get<string>('EngineModel');
  const engineManufacturer = get<string>('engineManufacturer') || get<string>('EngineManufacturer');
  
  // Transmission
  const transmissionStyle = get<string>('transmissionStyle') || get<string>('TransmissionStyle');
  const transmissionSpeeds = get<number>('transmissionSpeeds') || get<number>('TransmissionSpeeds');
  
  // Dimensions
  const doors = get<number>('doors') || get<number>('Doors');
  const gvwr = get<string>('gvwr') || get<string>('GVWR');
  const wheelbase = get<string>('wheelbase') || get<string>('WheelBaseShort');
  
  // Manufacturer info
  const plantCity = get<string>('plantCity') || get<string>('PlantCity');
  const plantState = get<string>('plantState') || get<string>('PlantState');
  const plantCountry = get<string>('plantCountry') || get<string>('PlantCountry');
  const manufacturerName = get<string>('manufacturerName') || get<string>('Manufacturer');
  
  // Safety
  const ncapOverallRating = get<string>('ncapOverallRating');
  const abs = get<string>('abs') || get<string>('ABS');
  const airbagLocations = get<string>('airbagLocations') || get<string>('AirBagLocFront');
  
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data);

  const hasData = make || model || year || vin;
  const hasEngineSpecs = engineCylinders || engineHP || engineDisplacement;
  const hasPlantInfo = plantCity || plantCountry;

  // Build transmission display string
  const transmissionDisplay = transmissionStyle 
    ? `${transmissionStyle}${transmissionSpeeds ? ` (${transmissionSpeeds}-Speed)` : ''}`
    : undefined;

  // Build plant location string
  const plantLocation = hasPlantInfo
    ? [plantCity, plantState, plantCountry].filter(Boolean).join(', ')
    : undefined;

  return (
    <div className="space-y-3">
      {/* Vehicle Image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={`${year} ${make} ${model}` || 'Vehicle'}
            className="w-full max-w-[200px] h-auto object-contain rounded"
          />
        </div>
      )}

      {/* Year Make Model */}
      {(year || make || model) && (
        <div className="text-center">
          <p className="text-lg font-bold">
            {year} {make} {model}
          </p>
          {trim && <p className="text-sm text-muted-foreground">{trim}</p>}
          {series && series !== trim && <p className="text-xs text-muted-foreground">{series}</p>}
        </div>
      )}

      {/* VIN */}
      {vin && (
        <div className="bg-muted/50 rounded-md p-2 text-center">
          <p className="text-xs text-muted-foreground">VIN</p>
          <p className="font-mono text-sm tracking-wider break-all">{vin}</p>
        </div>
      )}

      {/* Status Badges */}
      <div className="flex justify-center gap-2 flex-wrap">
        {bodyClass && (
          <Badge variant="outline" className="text-xs">
            <Car className="h-3 w-3 mr-1" />
            {bodyClass}
          </Badge>
        )}
        {fuelType && (
          <Badge variant="secondary" className="text-xs">
            <Fuel className="h-3 w-3 mr-1" />
            {fuelType}
            {fuelTypeSecondary && `/${fuelTypeSecondary}`}
          </Badge>
        )}
        {driveType && (
          <Badge variant="secondary" className="text-xs">
            {driveType}
          </Badge>
        )}
        {ncapOverallRating && (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <Shield className="h-3 w-3 mr-1" />
            {ncapOverallRating}★ Safety
          </Badge>
        )}
      </div>

      {/* Engine Specs */}
      {hasEngineSpecs && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            <Gauge className="h-3 w-3 inline mr-1" />
            Engine Specifications
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {engineCylinders && (
              <div>
                <p className="text-xs text-muted-foreground">Cylinders</p>
                <p className="font-semibold">{engineCylinders}</p>
              </div>
            )}
            {engineHP && (
              <div>
                <p className="text-xs text-muted-foreground">Horsepower</p>
                <p className="font-semibold">{engineHP} HP</p>
              </div>
            )}
            {engineDisplacement && (
              <div>
                <p className="text-xs text-muted-foreground">Displacement</p>
                <p className="font-semibold">{engineDisplacement}L</p>
              </div>
            )}
          </div>
          {engineModel && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Engine: {engineModel}
            </p>
          )}
        </div>
      )}

      {/* Market Value */}
      {marketValue && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">Estimated Value</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Low</div>
              <div className="font-semibold text-red-500">{marketValue.low}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Mid</div>
              <div className="font-semibold text-green-500">{marketValue.mid}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">High</div>
              <div className="font-semibold text-blue-500">{marketValue.high}</div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Details */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Make" value={make} />
          <DataRow label="Model" value={model} />
          <DataRow label="Year" value={year} />
          <DataRow label="Body Style" value={bodyClass} />
          <DataRow label="Doors" value={doors} />
          <DataRow label="Transmission" value={transmissionDisplay} />
          <DataRow label="Drive Type" value={driveType} />
          <DataRow label="Fuel Type" value={fuelType} />
          {gvwr && <DataRow label="GVWR" value={gvwr} />}
          {wheelbase && <DataRow label="Wheelbase" value={wheelbase} />}
        </div>
      )}

      {/* Plant Location */}
      {plantLocation && (
        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <MapPin className="h-3 w-3" />
          Built in {plantLocation}
        </p>
      )}

      {/* Manufacturer */}
      {manufacturerName && manufacturerName !== make && (
        <p className="text-xs text-center text-muted-foreground">
          Manufactured by {manufacturerName}
        </p>
      )}

      {/* No Data Fallback */}
      {!hasData && !thumbnail && (
        <div className="text-center py-4">
          <Car className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Vehicle verified but detailed info unavailable
          </p>
        </div>
      )}

      {/* External Link */}
      {externalUrl && (
        
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
        >
          View Vehicle History <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default NhtsaSection;