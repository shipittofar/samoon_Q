/**
 * Platform Administration — Automation group — P9.4 Phase C
 *
 * `notifications` (P9.0) already lives in this IA group via its own
 * `group: 'Automation'` tag. This file adds Queues, Jobs, Scheduler, and
 * the outbound-provider modules (Email/SMS/Push/OAuth) the audit found
 * missing as dedicated provider-management surfaces.
 */
import { defineField } from '@/config/field'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

registerAdminModule({
  id: 'platform.queues',
  name: 'Queues',
  description: 'Background job queue configuration.',
  group: 'Automation',
  icon: 'ListOrdered',
  platformPermission: 'platform.automation.view',
  fields: [
    defineField({ id: 'max_queue_depth', title: 'Max Queue Depth', category: 'automation', type: 'number', default: 10000, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 100 } }),
    defineField({ id: 'dead_letter_enabled', title: 'Dead-Letter Queue Enabled', category: 'automation', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.jobs',
  name: 'Jobs',
  description: 'Background job retry and timeout policy.',
  group: 'Automation',
  icon: 'Cog',
  platformPermission: 'platform.automation.view',
  fields: [
    defineField({ id: 'max_retry_attempts', title: 'Max Retry Attempts', category: 'automation', type: 'number', default: 5, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0, max: 20 } }),
    defineField({ id: 'job_timeout_seconds', title: 'Job Timeout (seconds)', category: 'automation', type: 'number', default: 300, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})

registerAdminModule({
  id: 'platform.scheduler',
  name: 'Scheduler',
  description: 'Scheduled/cron job execution policy.',
  group: 'Automation',
  icon: 'CalendarClock',
  platformPermission: 'platform.automation.view',
  fields: [
    defineField({ id: 'scheduler_enabled', title: 'Scheduler Enabled', category: 'automation', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'misfire_grace_seconds', title: 'Misfire Grace Period (seconds)', category: 'automation', type: 'number', default: 60, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 0 } }),
  ],
})

registerAdminModule({
  id: 'platform.email_providers',
  name: 'Email Providers',
  description: 'Transactional email provider configuration and failover.',
  group: 'Automation',
  icon: 'Mail',
  platformPermission: 'platform.automation.view',
  fields: [
    defineField({ id: 'primary_provider', title: 'Primary Provider', category: 'automation', type: 'select', default: 'sendgrid', options: [
      { value: 'sendgrid', label: 'SendGrid' },
      { value: 'ses', label: 'Amazon SES' },
      { value: 'postmark', label: 'Postmark' },
      { value: 'mailgun', label: 'Mailgun' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
    defineField({ id: 'failover_enabled', title: 'Automatic Failover', category: 'automation', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.sms_providers',
  name: 'SMS Providers',
  description: 'SMS/OTP delivery provider configuration and failover.',
  group: 'Automation',
  icon: 'MessageSquare',
  platformPermission: 'platform.automation.view',
  fields: [
    defineField({ id: 'primary_provider', title: 'Primary Provider', category: 'automation', type: 'select', default: 'twilio', options: [
      { value: 'twilio', label: 'Twilio' },
      { value: 'vonage', label: 'Vonage' },
      { value: 'sns', label: 'Amazon SNS' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
    defineField({ id: 'failover_enabled', title: 'Automatic Failover', category: 'automation', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.push_providers',
  name: 'Push Providers',
  description: 'Push notification delivery provider configuration.',
  group: 'Automation',
  icon: 'BellRing',
  platformPermission: 'platform.automation.view',
  fields: [
    defineField({ id: 'provider', title: 'Provider', category: 'automation', type: 'select', default: 'fcm', options: [
      { value: 'fcm', label: 'Firebase Cloud Messaging' },
      { value: 'apns', label: 'Apple Push Notification Service' },
      { value: 'onesignal', label: 'OneSignal' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
  ],
})

registerAdminModule({
  id: 'platform.oauth_providers',
  name: 'OAuth Providers',
  description: 'Third-party OAuth login providers available to tenants.',
  group: 'Automation',
  icon: 'LogIn',
  platformPermission: 'platform.automation.view',
  fields: [
    defineField({ id: 'google_enabled', title: 'Google', category: 'automation', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'apple_enabled', title: 'Apple', category: 'automation', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'facebook_enabled', title: 'Facebook', category: 'automation', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
  ],
})

registerAdminModule({
  id: 'platform.announcements',
  name: 'Announcements',
  description: 'Platform-wide announcement banner configuration.',
  group: 'Platform',
  icon: 'Megaphone',
  platformPermission: 'platform.dashboard.view',
  fields: [
    defineField({ id: 'banner_enabled', title: 'Announcement Banner Enabled', category: 'platform', type: 'boolean', default: false, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'banner_message', title: 'Banner Message', category: 'platform', type: 'string', default: '', permissions: PERMISSIONS, uiControl: 'textarea' }),
    defineField({ id: 'banner_severity', title: 'Severity', category: 'platform', type: 'select', default: 'info', options: [
      { value: 'info', label: 'Info' },
      { value: 'warning', label: 'Warning' },
      { value: 'critical', label: 'Critical' },
    ], permissions: PERMISSIONS, uiControl: 'radio' }),
  ],
})
