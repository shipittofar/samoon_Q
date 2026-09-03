'use client'

import type { TimeSeries } from '@/types/analytics'

interface MiniBarChartProps {
  data: TimeSeries[]
  height?: number
  color?: string
  className?: string
}

export function MiniBarChart({ data, height = 48, color = 'var(--chart-1)', className }: MiniBarChartProps) {
  if (!data.length) return null

  const values = data.map((d) => d.value)
  const max = Math.max(...values)
  const min = Math.min(0, Math.min(...values))
  const range = max - min || 1

  const width = 320
  const barW = Math.max(1, (width / data.length) - 1)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label="Bar chart"
      role="img"
      style={{ display: 'block', width: '100%', height }}
    >
      {data.map((d, i) => {
        const barH = Math.max(1, ((d.value - min) / range) * height)
        return (
          <rect
            key={d.date}
            x={i * (barW + 1)}
            y={height - barH}
            width={barW}
            height={barH}
            fill={color}
            opacity={0.8}
          />
        )
      })}
    </svg>
  )
}
