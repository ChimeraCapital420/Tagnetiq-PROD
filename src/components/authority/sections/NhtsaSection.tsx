// FILE: src/components/authority/sections/NhtsaSection.tsx
// NHTSA (Vehicles) authority data display
// v7.5 - Bulletproof FULL VIN decoder extraction

'use client';

import React from 'react';
import { ExternalLink, Car, Gauge, Fuel, Settings, Calendar, MapPin, Shield, Zap, Activity, AlertTriangle, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatNumber } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

export const NhtsaSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Core identification
  const thumbnail = getThumbnailUrl(data);
  const vin = get<string>('vin') || get<string>('VIN');
  const make = get<string>('make') || get<string>('Make');
  const model = get<string>('model') || get<string>('Model');
  const year = get<number>('vehicleYear') || get<number>('year') || get<number>('ModelYear');
  const trim = get<string>('trim') || get<string>('Trim');
  const trim2 = get<string>('trim2') || get<string>('Trim2');
  const series = get<string>('series') || get<string>('Series');
  const series2 = get<string>('series2') || get<string>('Series2');
  
  // Body & Type
  const bodyClass = get<string>('bodyClass') || get<string>('BodyClass');
  const vehicleType = get<string>('vehicleType') || get<string>('VehicleType');
  const driveType = get<string>('driveType') || get<string>('DriveType');
  const doors = get<number>('doors') || get<number>('Doors');
  const windows = get<number>('windows') || get<number>('Windows');
  const bedType = get<string>('bedType') || get<string>('BedType');
  const bedLength = get<string>('bedLength') || get<string>('BedLengthIN');
  const cabType = get<string>('cabType') || get<string>('CabType');
  const roofType = get<string>('roofType') || get<string>('RoofType');
  
  // Fuel & Electrification
  const fuelType = get<string>('fuelType') || get<string>('FuelTypePrimary');
  const fuelTypeSecondary = get<string>('fuelTypeSecondary') || get<string>('FuelTypeSecondary');
  const electrificationLevel = get<string>('electrificationLevel') || get<string>('ElectrificationLevel');
  const chargerLevel = get<string>('chargerLevel') || get<string>('ChargerLevel');
  const chargerPowerKW = get<number>('chargerPowerKW') || get<number>('ChargerPowerKW');
  
  // Battery (EVs)
  const batteryKWh = get<number>('batteryKWh') || get<number>('BatteryKWh');
  const batteryV = get<number>('batteryV') || get<number>('BatteryV');
  const batteryCells = get<number>('batteryCells') || get<number>('BatteryCells');
  const batteryModules = get<number>('batteryModules') || get<number>('BatteryModules');
  const batteryPacks = get<number>('batteryPacks') || get<number>('BatteryPacks');
  const evDriveUnit = get<string>('evDriveUnit') || get<string>('EVDriveUnit');
  
  // Engine specs
  const engineCylinders = get<number>('engineCylinders') || get<number>('EngineCylinders');
  const engineDisplacement = get<string>('engineDisplacement') || get<string>('DisplacementL');
  const displacementCC = get<number>('displacementCC') || get<number>('DisplacementCC');
  const displacementCI = get<number>('displacementCI') || get<number>('DisplacementCI');
  const engineHP = get<number>('engineHP') || get<number>('EngineHP');
  const engineKW = get<number>('engineKW') || get<number>('EngineKW');
  const engineModel = get<string>('engineModel') || get<string>('EngineModel');
  const engineManufacturer = get<string>('engineManufacturer') || get<string>('EngineManufacturer');
  const engineConfiguration = get<string>('engineConfiguration') || get<string>('EngineConfiguration');
  const turbo = get<string>('turbo') || get<string>('Turbo');
  const valveTrainDesign = get<string>('valveTrainDesign') || get<string>('ValveTrainDesign');
  const engineBrakeHP = get<number>('engineBrakeHP') || get<number>('EngineBrake_HP_From');
  
  // Transmission
  const transmissionStyle = get<string>('transmissionStyle') || get<string>('TransmissionStyle');
  const transmissionSpeeds = get<number>('transmissionSpeeds') || get<number>('TransmissionSpeeds');
  
  // Dimensions & Weight
  const gvwr = get<string>('gvwr') || get<string>('GVWR');
  const gcwr = get<string>('gcwr') || get<string>('GCWR');
  const curbWeight = get<number>('curbWeight') || get<number>('CurbWeightLB');
  const wheelbase = get<string>('wheelbase') || get<string>('WheelBaseShort');
  const wheelbaseLong = get<string>('wheelbaseLong') || get<string>('WheelBaseLong');
  const trackWidth = get<string>('trackWidth') || get<string>('TrackWidth');
  const wheelSizeFront = get<string>('wheelSizeFront') || get<string>('WheelSizeFront');
  const wheelSizeRear = get<string>('wheelSizeRear') || get<string>('WheelSizeRear');
  const steeringLocation = get<string>('steeringLocation') || get<string>('SteeringLocation');
  
  // Manufacturer info
  const plantCity = get<string>('plantCity') || get<string>('PlantCity');
  const plantState = get<string>('plantState') || get<string>('PlantState');
  const plantCountry = get<string>('plantCountry') || get<string>('PlantCountry');
  const plantCompanyName = get<string>('plantCompanyName') || get<string>('PlantCompanyName');
  const manufacturerName = get<string>('manufacturerName') || get<string>('Manufacturer');
  const manufacturerId = get<number>('manufacturerId') || get<number>('ManufacturerId');
  
  // Safety Ratings
  const ncapOverallRating = get<string>('ncapOverallRating') || get<string>('NCSANote');
  const ncapFrontCrash = get<string>('ncapFrontCrash');
  const ncapSideCrash = get<string>('ncapSideCrash');
  const ncapRollover = get<string>('ncapRollover');
  
  // Safety Equipment - Airbags
  const airbagLocFront = get<string>('airbagLocFront') || get<string>('AirBagLocFront');
  const airbagLocSide = get<string>('airbagLocSide') || get<string>('AirBagLocSide');
  const airbagLocCurtain = get<string>('airbagLocCurtain') || get<string>('AirBagLocCurtain');
  const airbagLocKnee = get<string>('airbagLocKnee') || get<string>('AirBagLocKnee');
  const seatCushionAirbag = get<string>('seatCushionAirbag') || get<string>('SeatCushionSideAirbag');
  
  // Safety Equipment - Active Systems
  const abs = get<string>('abs') || get<string>('ABS');
  const esc = get<string>('esc') || get<string>('ESC');
  const tractionControl = get<string>('tractionControl') || get<string>('TractionControl');
  const tpms = get<string>('tpms') || get<string>('TPMS');
  
  // ADAS Features
  const forwardCollisionWarning = get<string>('forwardCollisionWarning') || get<string>('ForwardCollisionWarning');
  const aeb = get<string>('aeb') || get<string>('AutomaticEmergencyBraking');
  const aebPedestrian = get<string>('aebPedestrian') || get<string>('AEB_Pedestrian');
  const blindSpotMon = get<string>('blindSpotMon') || get<string>('BlindSpotMon');
  const blindSpotIntervention = get<string>('blindSpotIntervention') || get<string>('BlindSpotIntervention');
  const laneDepartureWarning = get<string>('laneDepartureWarning') || get<string>('LaneDepartureWarning');
  const laneKeepSystem = get<string>('laneKeepSystem') || get<string>('LaneKeepSystem');
  const laneCenteringAssist = get<string>('laneCenteringAssist') || get<string>('LaneCenteringAssistance');
  const adaptiveCruiseControl = get<string>('adaptiveCruiseControl') || get<string>('AdaptiveCruiseControl');
  const adaptiveHeadlights = get<string>('adaptiveHeadlights') || get<string>('AdaptiveHeadlights');
  const rearCrossTrafficAlert = get<string>('rearCrossTrafficAlert') || get<string>('RearCrossTrafficAlert');
  const rearAutoEmergencyBraking = get<string>('rearAutoEmergencyBraking') || get<string>('RearAutomaticEmergencyBraking');
  const parkAssist = get<string>('parkAssist') || get<string>('ParkAssist');
  const rearVisibilitySystem = get<string>('rearVisibilitySystem') || get<string>('RearVisibilitySystem');
  
  // Automation Level
  const saeAutomationLevel = get<string>('saeAutomationLevel') || get<string>('SAE_AutomationLevel');
  
  // Other
  const basePrice = get<number>('basePrice') || get<number>('BasePrice');
  const destinationMarket = get<string>('destinationMarket') || get<string>('DestinationMarket');
  const note = get<string>('note') || get<string>('Note');
  const errorCode = get<string>('errorCode') || get<string>('ErrorCode');
  
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data);

  // Derived values
  const hasData = make || model || year || vin;
  const hasEngineSpecs = engineCylinders || engineHP || engineDisplacement || engineConfiguration;
  const hasPlantInfo = plantCity || plantCountry;
  const hasBatteryInfo = batteryKWh || batteryCells || evDriveUnit;
  const hasAirbags = airbagLocFront || airbagLocSide || airbagLocCurtain || airbagLocKnee;
  const hasADAS = forwardCollisionWarning || aeb || blindSpotMon || laneDepartureWarning || adaptiveCruiseControl;
  const hasSafetyEquipment = abs || esc || tractionControl || tpms;
  const isElectric = electrificationLevel && electrificationLevel !== 'Not Applicable';

  const transmissionDisplay = transmissionStyle 
    ? `${transmissionStyle}${transmissionSpeeds ? ` (${transmissionSpeeds}-Speed)` : ''}`
    : undefined;

  const plantLocation = hasPlantInfo
    ? [plantCity, plantState, plantCountry].filter(Boolean).join(', ')
    : undefined;

  const trimDisplay = [trim, trim2].filter(Boolean).join(' / ');
  const seriesDisplay = [series, series2].filter(Boolean).join(' / ');

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
          <p className="text-lg font-bold">{year} {make} {model}</p>
          {trimDisplay && <p className="text-sm text-muted-foreground">{trimDisplay}</p>}
          {seriesDisplay && seriesDisplay !== trimDisplay && <p className="text-xs text-muted-foreground">{seriesDisplay}</p>}
        </div>
      )}

      {/* VIN Display */}
      {vin && (
        <div className="bg-muted/50 rounded-md p-2 text-center">
          <p className="text-xs text-muted-foreground">Vehicle Identification Number</p>
          <p className="font-mono text-sm tracking-wider break-all select-all">{vin}</p>
        </div>
      )}

      {/* Primary Status Badges */}
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
            {fuelTypeSecondary && ` / ${fuelTypeSecondary}`}
          </Badge>
        )}
        {isElectric && (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
            <Zap className="h-3 w-3 mr-1" />
            {electrificationLevel}
          </Badge>
        )}
        {driveType && (
          <Badge variant="secondary" className="text-xs">{driveType}</Badge>
        )}
        {ncapOverallRating && (
          <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
            <Shield className="h-3 w-3 mr-1" />
            {ncapOverallRating}★ Safety
          </Badge>
        )}
        {turbo === 'Yes' && (
          <Badge variant="secondary" className="text-xs">Turbo</Badge>
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
                <p className="font-semibold">{engineCylinders}{engineConfiguration && ` ${engineConfiguration}`}</p>
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
          {(engineModel || engineManufacturer) && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              {engineManufacturer && `${engineManufacturer} `}{engineModel}
            </p>
          )}
          {valveTrainDesign && (
            <p className="text-xs text-center text-muted-foreground">{valveTrainDesign}</p>
          )}
        </div>
      )}

      {/* Battery Info (EVs) */}
      {hasBatteryInfo && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            <Zap className="h-3 w-3 inline mr-1" />
            Battery & Electric Drivetrain
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {batteryKWh && (
              <div>
                <p className="text-xs text-muted-foreground">Capacity</p>
                <p className="font-semibold">{batteryKWh} kWh</p>
              </div>
            )}
            {batteryV && (
              <div>
                <p className="text-xs text-muted-foreground">Voltage</p>
                <p className="font-semibold">{batteryV}V</p>
              </div>
            )}
            {chargerPowerKW && (
              <div>
                <p className="text-xs text-muted-foreground">Charger</p>
                <p className="font-semibold">{chargerPowerKW} kW</p>
              </div>
            )}
          </div>
          {evDriveUnit && (
            <p className="text-xs text-center text-muted-foreground mt-2">Drive Unit: {evDriveUnit}</p>
          )}
        </div>
      )}

      {/* ADAS Features */}
      {hasADAS && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            <Eye className="h-3 w-3 inline mr-1" />
            Driver Assistance Features
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {forwardCollisionWarning === 'Standard' && <Badge variant="outline" className="text-[10px]">FCW</Badge>}
            {aeb === 'Standard' && <Badge variant="outline" className="text-[10px]">AEB</Badge>}
            {blindSpotMon === 'Standard' && <Badge variant="outline" className="text-[10px]">BSM</Badge>}
            {laneDepartureWarning === 'Standard' && <Badge variant="outline" className="text-[10px]">LDW</Badge>}
            {laneKeepSystem === 'Standard' && <Badge variant="outline" className="text-[10px]">LKA</Badge>}
            {adaptiveCruiseControl === 'Standard' && <Badge variant="outline" className="text-[10px]">ACC</Badge>}
            {rearCrossTrafficAlert === 'Standard' && <Badge variant="outline" className="text-[10px]">RCTA</Badge>}
            {parkAssist === 'Standard' && <Badge variant="outline" className="text-[10px]">Park Assist</Badge>}
            {rearVisibilitySystem === 'Standard' && <Badge variant="outline" className="text-[10px]">Backup Cam</Badge>}
          </div>
          {saeAutomationLevel && (
            <p className="text-xs text-center text-muted-foreground mt-2">SAE Level {saeAutomationLevel} Automation</p>
          )}
        </div>
      )}

      {/* Safety Equipment */}
      {hasSafetyEquipment && (
        <div className="flex justify-center gap-2 flex-wrap text-xs text-muted-foreground">
          {abs === 'Standard' && <span>✓ ABS</span>}
          {esc === 'Standard' && <span>✓ ESC</span>}
          {tractionControl === 'Standard' && <span>✓ Traction</span>}
          {tpms === 'Direct' && <span>✓ TPMS</span>}
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

      {/* Base Price if available */}
      {basePrice && (
        <p className="text-xs text-center text-muted-foreground">
          Base MSRP: ${formatNumber(basePrice)}
        </p>
      )}

      {/* Vehicle Details Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Make" value={make} />
          <DataRow label="Model" value={model} />
          <DataRow label="Year" value={year} />
          <DataRow label="Body Style" value={bodyClass} />
          <DataRow label="Vehicle Type" value={vehicleType} />
          <DataRow label="Doors" value={doors} />
          <DataRow label="Transmission" value={transmissionDisplay} />
          <DataRow label="Drive Type" value={driveType} />
          <DataRow label="Fuel Type" value={fuelType} />
          <DataRow label="Steering" value={steeringLocation} />
          {gvwr && <DataRow label="GVWR" value={gvwr} />}
          {curbWeight && <DataRow label="Curb Weight" value={`${formatNumber(curbWeight)} lbs`} />}
          {wheelbase && <DataRow label="Wheelbase" value={`${wheelbase}"`} />}
          {bedType && <DataRow label="Bed Type" value={bedType} />}
          {bedLength && <DataRow label="Bed Length" value={`${bedLength}"`} />}
          {cabType && <DataRow label="Cab Type" value={cabType} />}
        </div>
      )}

      {/* Airbag Locations */}
      {hasAirbags && (
        <div className="text-xs text-muted-foreground">
          <p className="font-medium mb-1"><Shield className="h-3 w-3 inline mr-1" />Airbag Locations:</p>
          <p className="text-[11px]">
            {[airbagLocFront, airbagLocSide, airbagLocCurtain, airbagLocKnee].filter(Boolean).join(' • ')}
          </p>
        </div>
      )}

      {/* Plant Location */}
      {plantLocation && (
        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <MapPin className="h-3 w-3" />
          Built in {plantLocation}
          {plantCompanyName && ` by ${plantCompanyName}`}
        </p>
      )}

      {/* Manufacturer */}
      {manufacturerName && manufacturerName !== make && (
        <p className="text-xs text-center text-muted-foreground">
          Manufactured by {manufacturerName}
        </p>
      )}

      {/* Notes */}
      {note && (
        <p className="text-xs text-center text-muted-foreground italic">{note}</p>
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

      {/* External Link - SINGLE LINE */}
      {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2">View Vehicle History <ExternalLink className="h-3 w-3" /></a>}
    </div>
  );
};

export default NhtsaSection;