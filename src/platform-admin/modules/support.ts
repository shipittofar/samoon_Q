/**
 * Platform Administration — Support group — P9.4 Phase C
 */
import { defineField } from '@/config/field'
import { registerAdminModule } from '../register-module'

const PERMISSIONS = { view: 'settings.view', edit: 'settings.manage' }

registerAdminModule({
  id: 'platform.support_tickets',
  name: 'Support Tickets',
  description: 'Support ticket routing and SLA configuration.',
  group: 'Support',
  icon: 'LifeBuoy',
  platformPermission: 'platform.support.view',
  fields: [
    defineField({ id: 'default_sla_hours', title: 'Default First-Response SLA (hours)', category: 'support', type: 'number', default: 24, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
    defineField({ id: 'auto_assign_enabled', title: 'Auto-Assign Tickets', category: 'support', type: 'boolean', default: true, permissions: PERMISSIONS, uiControl: 'switch' }),
    defineField({ id: 'escalation_threshold_hours', title: 'Escalate After (hours)', category: 'support', type: 'number', default: 48, permissions: PERMISSIONS, uiControl: 'number', validation: { min: 1 } }),
  ],
})
