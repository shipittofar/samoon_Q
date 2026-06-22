'use client'

import type { TimeSeries } from '@/types/analytics'

interface SparklineProps {
  data: TimeSeries[]
  height?: number
  color?: string
  className?: string
}

export function Sparkline({ data, height = 32, color = 'var(--primary)', className }: SparklineProps) {
  if (data.length < 2) return null

  const values = data.map((d) => d.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const width = 160

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const areaPoints = [
    `0,${height}`,
    ...values.map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }),
    `${width},${height}`,
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label="Sparkline"
      role="img"
      style={{ display: 'block', width: '100%', height }}
    >
      <polygon points={areaPoints} fill={color} opacity={0.12} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
