interface Stat {
  value: string
  label: string
  sublabel?: string
}

interface PlatformStatsProps {
  stats: Stat[]
  className?: string
}

export function PlatformStats({ stats, className = '' }: PlatformStatsProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 ${className}`}>
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`py-8 px-6 text-center ${i < stats.length - 1 ? 'border-e border-[var(--border)]' : ''}`}
        >
          <p className="font-[var(--font-display)] text-3xl font-bold text-orange-500 mb-1">{stat.value}</p>
          <p className="text-sm font-medium text-[var(--fg)]">{stat.label}</p>
          {stat.sublabel && <p className="text-xs text-[var(--fg-muted)] mt-0.5">{stat.sublabel}</p>}
        </div>
      ))}
    </div>
  )
}
