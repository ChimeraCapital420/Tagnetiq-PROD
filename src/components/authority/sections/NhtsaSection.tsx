// FILE: src/components/authority/sections/NhtsaSection.tsx
// NHTSA (vehicles) authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { ExternalLink, Car, Fuel, Gauge, Factory } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow } from '../helpers';

export const NhtsaSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const vin = details.vin;
  const make = details.make;
  const model = details.model;
  const vehicleYear = details.vehicleYear || details.year;
  const trim = details.trim;
  const bodyClass = details.bodyClass;
  const vehicleType = details.vehicleType;
  const driveType = details.driveType;
  const fuelType = details.fuelType;
  const engineCylinders = details.engineCylinders;
  const engineDisplacement = details.engineDisplacement;
  const engineHP = details.engineHP;
  const transmissionStyle = details.transmissionStyle;
  const doors = details.doors;
  const plantCity = details.plantCity;
  const plantCountry = details.plantCountry;
  const manufacturerName = details.manufacturerName;
  const externalUrl = details.externalUrl || data.externalUrl;

  return (
    <div className="space-y-3">
      {/* Vehicle title */}
      <div className="flex items-center justify-center gap-2 text-lg font-semibold">
        <Car className="h-5 w-5 text-blue-500" />
        <span>{vehicleYear} {make} {model}</span>
      </div>

      {/* Trim badge */}
      {trim && (
        <div className="flex justify-center">
          <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-sm font-medium">
            {trim}
          </span>
        </div>
      )}

      {/* VIN display */}
      {vin && (
        <div className="bg-muted/50 rounded-md p-2 text-center">
          <div className="text-xs text-muted-foreground mb-1">VIN</div>
          <div className="font-mono text-sm font-medium break-all">{vin}</div>
        </div>
      )}

      {/* Engine specs */}
      {(engineCylinders || engineDisplacement || engineHP) && (
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground text-center mb-1 flex items-center justify-center gap-1">
            <Gauge className="h-3 w-3" />
            Engine Specs
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {engineCylinders && (
              <div>
                <div className="text-muted-foreground text-xs">Cylinders</div>
                <div className="font-medium">{engineCylinders}</div>
              </div>
            )}
            {engineDisplacement && (
              <div>
                <div className="text-muted-foreground text-xs">Displacement</div>
                <div className="font-medium">{engineDisplacement}L</div>
              </div>
            )}
            {engineHP && (
              <div>
                <div className="text-muted-foreground text-xs">Horsepower</div>
                <div className="font-medium">{engineHP} HP</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Body Style" value={bodyClass} />
        <DataRow label="Vehicle Type" value={vehicleType} />
        <DataRow label="Drive Type" value={driveType} />
        <DataRow label="Transmission" value={transmissionStyle} />
        <DataRow label="Doors" value={doors} />
        {fuelType && (
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Fuel Type</span>
            <span className="text-sm font-medium flex items-center gap-1">
              <Fuel className="h-3 w-3" />
              {fuelType}
            </span>
          </div>
        )}
        <DataRow label="Manufacturer" value={manufacturerName} />
      </div>

      {/* Plant info */}
      {(plantCity || plantCountry) && (
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Factory className="h-3 w-3" />
          Built in {[plantCity, plantCountry].filter(Boolean).join(', ')}
        </div>
      )}

      {/* External link */}
      {(externalUrl || vin) && (
        <a
          href={externalUrl || `https://vpic.nhtsa.dot.gov/decoder/Decoder?VIN=${vin}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          NHTSA VIN Decoder <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Data provided by NHTSA (Free API)
      </p>
    </div>
  );
};

export default NhtsaSection;