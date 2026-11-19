/**
 * Maps Module — Phase L1 (docs/BUSINESS_SERVICES_ROADMAP.md)
 *
 * Map provider selection, defaults for the map view, service-area limits and
 * location settings. Read at runtime through src/lib/maps/config.ts.
 *
 * Keys: only *browser* keys belong here (domain-restricted keys that map
 * SDKs require in the page anyway). Server-side keys for paid geocoding /
 * routing APIs must live in backend secrets and be used through a backend
 * proxy — never in Platform Configuration (see the Secret rule in types.ts).
 */
import { defineField } from '../field'
import { platformConfigurationRegistry } from '../registry'
import type { ConfigModuleDefinition } from '../types'
import { DEFAULT_NAV_TEMPLATES } from '@/lib/navigation/deep-links'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }
const PLATFORM_LOCKED = { level: 'platform', canOverride: false, mode: 'locked', fallback: 'inherit' } as const

export const MAP_PROVIDER_OPTIONS = [
  { value: 'osm', label: 'OpenStreetMap (Leaflet) — free, no key' },
  { value: 'neshan', label: 'Neshan' },
  { value: 'mapir', label: 'Map.ir' },
  { value: 'google', label: 'Google Maps' },
] as const

export const MAPS_MODULE: ConfigModuleDefinition = {
  id: 'maps',
  name: 'Maps & Location',
  description: 'Map provider, default map view, service-area limits and customer location settings.',
  category: 'infrastructure',
  group: 'Infrastructure',
  version: '1.0.0',
  icon: 'MapPinned',
  permissions: PERMISSIONS,
  sections: [
    {
      id: 'maps.provider',
      title: 'Provider',
      description: 'Which map service renders maps. The fallback is used automatically when the primary fails or has no key.',
      fields: [
        defineField({
          id: 'maps.provider',
          title: 'Map Provider',
          category: 'infrastructure',
          type: 'select',
          default: 'osm',
          options: [...MAP_PROVIDER_OPTIONS],
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
        defineField({
          id: 'maps.fallback_provider',
          title: 'Fallback Provider',
          category: 'infrastructure',
          type: 'select',
          default: 'osm',
          options: [...MAP_PROVIDER_OPTIONS],
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
        defineField({
          id: 'maps.osm_tile_url',
          title: 'OpenStreetMap Tile URL',
          description: 'XYZ tile template. Use your own tile server in production — the public OSM servers have a strict usage policy.',
          category: 'infrastructure',
          type: 'string',
          default: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
        defineField({
          id: 'maps.neshan_web_key',
          title: 'Neshan Web Key (browser)',
          description: 'Domain-restricted web map key from the Neshan developer panel.',
          category: 'infrastructure',
          type: 'string',
          default: '',
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
          dependency: { hiddenWhen: { fieldId: 'maps.provider', notEquals: 'neshan' } },
        }),
        defineField({
          id: 'maps.mapir_web_key',
          title: 'Map.ir API Key (browser)',
          category: 'infrastructure',
          type: 'string',
          default: '',
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
          dependency: { hiddenWhen: { fieldId: 'maps.provider', notEquals: 'mapir' } },
        }),
        defineField({
          id: 'maps.google_web_key',
          title: 'Google Maps JavaScript Key (browser)',
          category: 'infrastructure',
          type: 'string',
          default: '',
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
          dependency: { hiddenWhen: { fieldId: 'maps.provider', notEquals: 'google' } },
        }),
      ],
    },
    {
      id: 'maps.view',
      title: 'Default Map View',
      fields: [
        defineField({
          id: 'maps.default_center_lat',
          title: 'Default Center — Latitude',
          category: 'infrastructure',
          type: 'number',
          default: 35.6892,
          validation: { min: -90, max: 90 },
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
        defineField({
          id: 'maps.default_center_lng',
          title: 'Default Center — Longitude',
          category: 'infrastructure',
          type: 'number',
          default: 51.389,
          validation: { min: -180, max: 180 },
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
        defineField({
          id: 'maps.default_zoom',
          title: 'Default Zoom',
          category: 'infrastructure',
          type: 'number',
          default: 12,
          validation: { min: 2, max: 19 },
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
      ],
    },
    {
      id: 'maps.service_area',
      title: 'Service Areas',
      fields: [
        defineField({
          id: 'maps.max_service_radius_km',
          title: 'Maximum Service Radius (km)',
          description: 'Upper bound for any branch service-area radius. Larger values are clamped.',
          category: 'infrastructure',
          type: 'number',
          default: 50,
          validation: { min: 1, max: 500 },
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
      ],
    },
    {
      id: 'maps.location',
      title: 'Customer Location',
      fields: [
        defineField({
          id: 'maps.geolocation_enabled',
          title: 'Use Device Location',
          description: 'Ask customers for their location to show nearby businesses.',
          category: 'infrastructure',
          type: 'boolean',
          default: true,
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
        defineField({
          id: 'maps.min_location_accuracy_m',
          title: 'Ask to Confirm Location Above (meters)',
          description: 'When the device reports a worse accuracy than this, the customer is asked to confirm their position on the map.',
          category: 'infrastructure',
          type: 'number',
          default: 1000,
          validation: { min: 50, max: 20000 },
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
          dependency: { hiddenWhen: { fieldId: 'maps.geolocation_enabled', equals: false } },
        }),
      ],
    },
    {
      id: 'maps.navigation',
      title: 'Directions & Navigation',
      description: 'How in-app routes are computed and how links to external navigation apps are built.',
      fields: [
        defineField({
          id: 'maps.routing_source',
          title: 'In-app Route Source',
          description: 'Estimate draws a straight guide line with estimated time. Backend uses the platform routing proxy (/geo/route/). OSRM calls a self-hosted OSRM server.',
          category: 'infrastructure',
          type: 'select',
          default: 'estimate',
          options: [
            { value: 'estimate', label: 'Estimate (no routing service)' },
            { value: 'backend', label: 'Backend routing proxy' },
            { value: 'osrm', label: 'Self-hosted OSRM' },
          ],
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
        defineField({
          id: 'maps.osrm_url',
          title: 'OSRM Server URL',
          description: 'Base URL of your OSRM server, e.g. https://osrm.example.com. The customer\'s position is sent to it — use a server you operate.',
          category: 'infrastructure',
          type: 'string',
          default: '',
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
          dependency: { hiddenWhen: { fieldId: 'maps.routing_source', notEquals: 'osrm' } },
        }),
        defineField({
          id: 'maps.nav_neshan_url',
          title: 'Neshan Link Template',
          description: 'https link that opens a place in Neshan. Placeholders: {lat} {lng} {label}.',
          category: 'infrastructure',
          type: 'string',
          default: DEFAULT_NAV_TEMPLATES.neshan,
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
        defineField({
          id: 'maps.nav_balad_url',
          title: 'Balad Link Template',
          description: 'https link that opens a place in Balad. Placeholders: {lat} {lng} {label}.',
          category: 'infrastructure',
          type: 'string',
          default: DEFAULT_NAV_TEMPLATES.balad,
          permissions: PERMISSIONS,
          inheritance: PLATFORM_LOCKED,
        }),
      ],
    },
  ],
}

platformConfigurationRegistry.register(MAPS_MODULE)
