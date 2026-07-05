/**
 * Platform Dashboard widgets — P9.4 Phase D
 *
 * Registers the widgets the phase calls out by name. `compute()` returns
 * illustrative mock values — consistent with how every other demo number
 * in this codebase works (`NEXT_PUBLIC_USE_MOCK`) — not live production
 * metrics; see docs/P9.4_PLATFORM_ADMIN_CENTER.md's extension guide for how
 * a real backend would replace `compute()` with a data hook.
 */
import { platformDashboardRegistry } from './dashboard'

platformDashboardRegistry.register({
  id: 'active_businesses', title: 'Active Businesses', group: 'Businesses', kind: 'stat', icon: 'Building2',
  platformPermission: 'platform.businesses.view',
  compute: () => ({ kind: 'stat', value: 6, deltaPercent: 12, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'online_users', title: 'Online Users', group: 'Users', kind: 'stat', icon: 'Users',
  platformPermission: 'platform.users.view',
  compute: () => ({ kind: 'stat', value: 143, deltaPercent: 8, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'orders_today', title: 'Orders Today', group: 'Businesses', kind: 'stat', icon: 'ShoppingBag',
  platformPermission: 'platform.businesses.view',
  compute: () => ({ kind: 'stat', value: 428, deltaPercent: 5, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'reservations_today', title: 'Reservations Today', group: 'Businesses', kind: 'stat', icon: 'CalendarClock',
  platformPermission: 'platform.businesses.view',
  compute: () => ({ kind: 'stat', value: 57, deltaPercent: -3, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'revenue_today', title: 'Revenue Today', group: 'Subscriptions', kind: 'stat', icon: 'DollarSign',
  platformPermission: 'platform.subscriptions.view',
  compute: () => ({ kind: 'stat', value: 18420, unit: '$', deltaPercent: 9, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'mrr', title: 'MRR', group: 'Subscriptions', kind: 'stat', icon: 'TrendingUp',
  platformPermission: 'platform.subscriptions.view',
  compute: () => ({ kind: 'stat', value: 42500, unit: '$', deltaPercent: 4, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'arr', title: 'ARR', group: 'Subscriptions', kind: 'stat', icon: 'LineChart',
  platformPermission: 'platform.subscriptions.view',
  compute: () => ({ kind: 'stat', value: 510000, unit: '$', deltaPercent: 4, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'failed_payments', title: 'Failed Payments', group: 'Subscriptions', kind: 'stat', icon: 'CreditCard',
  platformPermission: 'platform.subscriptions.view',
  compute: () => ({ kind: 'stat', value: 3, deltaPercent: -25, higherIsBetter: false }),
})

platformDashboardRegistry.register({
  id: 'new_signups', title: 'New Signups', group: 'Businesses', kind: 'stat', icon: 'UserPlus',
  platformPermission: 'platform.businesses.view',
  compute: () => ({ kind: 'stat', value: 12, deltaPercent: 20, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'server_health', title: 'Server Health', group: 'Monitoring', kind: 'status', icon: 'HeartPulse',
  platformPermission: 'platform.monitoring.view',
  compute: () => ({ kind: 'status', state: 'operational', label: 'All systems operational' }),
})

platformDashboardRegistry.register({
  id: 'error_rate', title: 'Error Rate', group: 'Monitoring', kind: 'stat', icon: 'Bug',
  platformPermission: 'platform.monitoring.view',
  compute: () => ({ kind: 'stat', value: 0.4, unit: '%', deltaPercent: -10, higherIsBetter: false }),
})

platformDashboardRegistry.register({
  id: 'queue_status', title: 'Queue Status', group: 'Automation', kind: 'status', icon: 'ListOrdered',
  platformPermission: 'platform.automation.view',
  compute: () => ({ kind: 'status', state: 'operational', label: '212 jobs queued, draining normally' }),
})

platformDashboardRegistry.register({
  id: 'background_jobs', title: 'Background Jobs', group: 'Automation', kind: 'stat', icon: 'Cog',
  platformPermission: 'platform.automation.view',
  compute: () => ({ kind: 'stat', value: 212, deltaPercent: 2, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'platform_alerts', title: 'Platform Alerts', group: 'Monitoring', kind: 'stat', icon: 'Siren',
  platformPermission: 'platform.monitoring.view',
  compute: () => ({ kind: 'stat', value: 0, deltaPercent: 0, higherIsBetter: false }),
})

platformDashboardRegistry.register({
  id: 'feature_rollouts', title: 'Feature Rollouts', group: 'Configuration', kind: 'list', icon: 'Flag',
  platformPermission: 'platform.configuration.view',
  compute: () => ({ kind: 'list', items: [
    { label: 'New Checkout Flow', value: '25% rollout' },
    { label: 'AI Menu Suggestions', value: '10% rollout' },
    { label: 'Dark Mode', value: '100% rollout' },
  ] }),
})

platformDashboardRegistry.register({
  id: 'abuse_reports', title: 'Abuse Reports', group: 'Security', kind: 'stat', icon: 'Flag',
  platformPermission: 'platform.security.view',
  compute: () => ({ kind: 'stat', value: 2, deltaPercent: -33, higherIsBetter: false }),
})

platformDashboardRegistry.register({
  id: 'api_usage', title: 'API Usage', group: 'Developer', kind: 'stat', icon: 'Terminal',
  platformPermission: 'platform.developer.view',
  compute: () => ({ kind: 'stat', value: 84200, unit: 'req/day', deltaPercent: 6, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'top_countries', title: 'Top Countries', group: 'Configuration', kind: 'list', icon: 'Globe2',
  platformPermission: 'platform.configuration.view',
  compute: () => ({ kind: 'list', items: [
    { label: 'United States', value: '38%' },
    { label: 'United Kingdom', value: '14%' },
    { label: 'United Arab Emirates', value: '9%' },
  ] }),
})

platformDashboardRegistry.register({
  id: 'top_businesses', title: 'Top Businesses', group: 'Businesses', kind: 'list', icon: 'Trophy',
  platformPermission: 'platform.businesses.view',
  compute: () => ({ kind: 'list', items: [
    { label: 'Savor Restaurant', value: '$5,240' },
    { label: 'Brew Cafe', value: '$3,110' },
    { label: 'The Oak Bar', value: '$2,875' },
  ] }),
})

platformDashboardRegistry.register({
  id: 'storage_usage', title: 'Storage Usage', group: 'Infrastructure', kind: 'stat', icon: 'HardDrive',
  platformPermission: 'platform.infrastructure.view',
  compute: () => ({ kind: 'stat', value: 62, unit: '% of quota', deltaPercent: 3, higherIsBetter: false }),
})

platformDashboardRegistry.register({
  id: 'email_success_rate', title: 'Email Success Rate', group: 'Automation', kind: 'stat', icon: 'Mail',
  platformPermission: 'platform.automation.view',
  compute: () => ({ kind: 'stat', value: 99.2, unit: '%', deltaPercent: 0.1, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'sms_success_rate', title: 'SMS Success Rate', group: 'Automation', kind: 'stat', icon: 'MessageSquare',
  platformPermission: 'platform.automation.view',
  compute: () => ({ kind: 'stat', value: 97.8, unit: '%', deltaPercent: -0.4, higherIsBetter: true }),
})

platformDashboardRegistry.register({
  id: 'push_delivery', title: 'Push Delivery', group: 'Automation', kind: 'stat', icon: 'BellRing',
  platformPermission: 'platform.automation.view',
  compute: () => ({ kind: 'stat', value: 95.1, unit: '%', deltaPercent: 1.2, higherIsBetter: true }),
})
