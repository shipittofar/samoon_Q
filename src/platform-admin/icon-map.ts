/**
 * Icon registry — P9.4 Phase D/E
 *
 * Every icon name referenced by a Platform Administration module (Phase C)
 * or dashboard widget (Phase D), mirroring the lookup-map pattern already
 * used by `AdminSidebar`'s `ICON_MAP` and Countries' flag lookup — one
 * shared map instead of each consumer re-importing lucide icons piecemeal.
 */
import {
  Activity, AlertTriangle, ArrowRightLeft, BarChart3, BellRing, Bug, Building2,
  CalendarClock, Clock, Cog, CreditCard, Database, DatabaseBackup, DollarSign,
  FileBadge, FileCheck, FileText, Flag, Gauge, GitBranch, Globe, Globe2,
  HardDrive, HeartPulse, History, Image, KeyRound, Layers, LayoutDashboard,
  LifeBuoy, LineChart, ListOrdered, Lock, LogIn, Mail, MapPinned, Megaphone,
  MessageSquare, Plug, Puzzle, Receipt, RotateCcw, Scale, ScrollText, Search,
  ShieldAlert, ShieldCheck, ShoppingBag, Siren, Smartphone, Sparkles, Store,
  Terminal, TrendingUp, Trophy, UserCircle, UserPlus, Users, Webhook, Wrench,
  Zap, LayoutGrid, type LucideIcon,
} from 'lucide-react'

export const PLATFORM_ADMIN_ICON_MAP: Record<string, LucideIcon> = {
  Activity, AlertTriangle, ArrowRightLeft, BarChart3, BellRing, Bug, Building2,
  CalendarClock, Clock, Cog, CreditCard, Database, DatabaseBackup, DollarSign,
  FileBadge, FileCheck, FileText, Flag, Gauge, GitBranch, Globe, Globe2,
  HardDrive, HeartPulse, History, Image, KeyRound, Layers, LayoutDashboard,
  LifeBuoy, LineChart, ListOrdered, Lock, LogIn, Mail, MapPinned, Megaphone,
  MessageSquare, Plug, Puzzle, Receipt, RotateCcw, Scale, ScrollText, Search,
  ShieldAlert, ShieldCheck, ShoppingBag, Siren, Smartphone, Sparkles, Store,
  Terminal, TrendingUp, Trophy, UserCircle, UserPlus, Users, Webhook, Wrench,
  Zap,
}

export function resolvePlatformAdminIcon(name: string | undefined): LucideIcon {
  return (name && PLATFORM_ADMIN_ICON_MAP[name]) || LayoutGrid
}
