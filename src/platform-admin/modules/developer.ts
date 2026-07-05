/**
 * Platform Administration — Developer group — P9.4 Phase C
 *
 * `api` (P9.0) already lives in this IA group via its own
 * `group: 'Developer'` tag. This file adds the developer-facing modules
 * the audit found missing: API Keys, Webhooks, Integrations, Marketplace,
 * Plugins, AI Providers, Developer Tools, Environment, Secrets, Licenses,
 * Version Management, Migration Center.
 */
import { defineField } from '@/config/field'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

registerAdminModule({
  id: 'platform.api_keys',
  name: 'API Keys',
  description: 'Platform and tenant API key issuance policy.',
  group: 'Developer',
  icon: 'KeyRound',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'max_keys_per_tenant', title: 'Max API Keys per Tenant', category: 'developer', type: 'number', default: 10, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
    defineField({ id: 'default_key_expiry_days', title: 'Default Key Expiry (days, 0 = never)', category: 'developer', type: 'number', default: 0, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0 } }),
  ],
})

registerAdminModule({
  id: 'platform.webhooks',
  name: 'Webhooks',
  description: 'Outbound webhook delivery and retry policy.',
  group: 'Developer',
  icon: 'Webhook',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'max_endpoints_per_tenant', title: 'Max Webhook Endpoints per Tenant', category: 'developer', type: 'number', default: 5, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
    defineField({ id: 'retry_backoff_seconds', title: 'Retry Backoff (seconds)', category: 'developer', type: 'number', default: 30, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
    defineField({ id: 'sign_payloads', title: 'Sign Webhook Payloads', category: 'developer', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.integrations',
  name: 'Integrations',
  description: 'Available third-party integrations for tenants.',
  group: 'Developer',
  icon: 'Plug',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'allow_custom_integrations', title: 'Allow Custom Integrations', category: 'developer', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.marketplace',
  name: 'Marketplace',
  description: 'Third-party app marketplace listing policy.',
  group: 'Developer',
  icon: 'Store',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'marketplace_enabled', title: 'Marketplace Enabled', category: 'developer', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'require_review_before_listing', title: 'Require Review Before Listing', category: 'developer', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.plugins',
  name: 'Plugins',
  description: 'Installable platform plugin policy.',
  group: 'Developer',
  icon: 'Puzzle',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'plugins_enabled', title: 'Plugins Enabled', category: 'developer', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'sandbox_untrusted_plugins', title: 'Sandbox Untrusted Plugins', category: 'developer', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.ai_providers',
  name: 'AI Providers',
  description: 'AI/LLM provider configuration for platform-powered features.',
  group: 'Developer',
  icon: 'Sparkles',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'primary_provider', title: 'Primary Provider', category: 'developer', type: 'select', default: 'anthropic', options: [
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'openai', label: 'OpenAI' },
      { value: 'google', label: 'Google' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
    defineField({ id: 'monthly_token_budget', title: 'Monthly Token Budget', category: 'developer', type: 'number', default: 1000000, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0 } }),
  ],
})

registerAdminModule({
  id: 'platform.developer_tools',
  name: 'Developer Tools',
  description: 'Internal developer tooling access (debug panels, query inspectors).',
  group: 'Developer',
  icon: 'Terminal',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'debug_mode_enabled', title: 'Debug Mode Enabled', category: 'developer', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.environment',
  name: 'Environment',
  description: 'Deployment environment identification and safeguards.',
  group: 'Developer',
  icon: 'Layers',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'environment_name', title: 'Environment Name', category: 'developer', type: 'select', default: 'staging', options: [
      { value: 'development', label: 'Development' },
      { value: 'staging', label: 'Staging' },
      { value: 'production', label: 'Production' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
    defineField({ id: 'protect_production_writes', title: 'Extra Confirmation for Production Writes', category: 'developer', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.secrets',
  name: 'Secrets',
  description: 'Secret rotation policy — actual secret values are never stored in configuration (see ConfigFieldType \'secret\', P9.0.1).',
  group: 'Developer',
  icon: 'Lock',
  platformPermission: 'platform.developer.manage',
  fields: [
    defineField({ id: 'rotation_period_days', title: 'Secret Rotation Period (days)', category: 'developer', type: 'number', default: 90, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
    defineField({ id: 'alert_before_expiry_days', title: 'Alert Before Expiry (days)', category: 'developer', type: 'number', default: 14, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})

registerAdminModule({
  id: 'platform.licenses',
  name: 'Licenses',
  description: 'Third-party software license tracking.',
  group: 'Developer',
  icon: 'FileBadge',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'license_audit_enabled', title: 'License Compliance Audit Enabled', category: 'developer', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.version_management',
  name: 'Version Management',
  description: 'API/schema version support window.',
  group: 'Developer',
  icon: 'GitBranch',
  platformPermission: 'platform.developer.view',
  fields: [
    defineField({ id: 'supported_api_versions', title: 'Supported API Versions', category: 'developer', type: 'array', default: ['v1'], permissions: PERMISSIONS, uiControl: 'json_editor' }),
    defineField({ id: 'deprecation_notice_days', title: 'Deprecation Notice Period (days)', category: 'developer', type: 'number', default: 90, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})

registerAdminModule({
  id: 'platform.migration_center',
  name: 'Migration Center',
  description: 'Data migration job safeguards.',
  group: 'Developer',
  icon: 'ArrowRightLeft',
  platformPermission: 'platform.developer.manage',
  fields: [
    defineField({ id: 'require_dry_run', title: 'Require Dry Run Before Execution', category: 'developer', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch', governance: { dangerous: true } }),
    defineField({ id: 'auto_backup_before_migration', title: 'Auto-Backup Before Migration', category: 'developer', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})
