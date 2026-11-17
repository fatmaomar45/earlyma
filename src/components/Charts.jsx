import { Box, Group, Stack, Text } from '@mantine/core'

const PALETTE = {
  teal: '#0d9488',
  blue: '#2563eb',
  grape: '#7c3aed',
  orange: '#ea580c',
  cyan: '#0891b2',
  green: '#16a34a',
  red: '#dc2626',
  gray: '#94a3b8',
  yellow: '#ca8a04',
}

export function BarChart({ data = [], labelWidth = 130, emptyLabel = '' }) {
  const max = Math.max(1, ...data.map((entry) => Number(entry.value) || 0))
  if (!data.length) return <Text c="dimmed" size="sm">{emptyLabel}</Text>

  return (
    <Stack gap="xs" aria-label="bar chart">
      {data.map((entry) => {
        const value = Number(entry.value) || 0
        return (
          <Group key={entry.label} gap="sm" wrap="nowrap" align="center">
            <Text size="xs" style={{ width: labelWidth, flexShrink: 0 }} truncate title={entry.label}>
              {entry.label}
            </Text>
            <Box className="bar-track" style={{ flex: 1 }}>
              <Box
                className="bar-fill"
                style={{
                  width: `${Math.max(value > 0 ? 4 : 0, (value / max) * 100)}%`,
                  background: PALETTE[entry.color] ?? PALETTE.teal,
                }}
              />
            </Box>
            <Text size="xs" fw={700} style={{ width: 34, textAlign: 'right' }}>{value}</Text>
          </Group>
        )
      })}
    </Stack>
  )
}

export function TrendChart({ series = [], labels = [], height = 180, emptyLabel = '' }) {
  const pointCount = labels.length
  if (!pointCount || !series.length) return <Text c="dimmed" size="sm">{emptyLabel}</Text>

  const width = 620
  const padding = { top: 14, right: 12, bottom: 28, left: 30 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const max = Math.max(1, ...series.flatMap((entry) => entry.values.map((value) => Number(value) || 0)))
  const stepX = pointCount > 1 ? innerWidth / (pointCount - 1) : 0

  const pointsFor = (values) => values.map((value, index) => {
    const x = padding.left + (pointCount > 1 ? stepX * index : innerWidth / 2)
    const y = padding.top + innerHeight - ((Number(value) || 0) / max) * innerHeight
    return `${x},${y}`
  }).join(' ')

  return (
    <Stack gap="xs">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="trend chart"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {[0, 0.5, 1].map((fraction) => {
          const y = padding.top + innerHeight * fraction
          return (
            <g key={fraction}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={4} y={y + 4} fontSize="9" fill="#94a3b8">{Math.round(max * (1 - fraction))}</text>
            </g>
          )
        })}
        {labels.map((label, index) => {
          const x = padding.left + (pointCount > 1 ? stepX * index : innerWidth / 2)
          return (
            <text key={label} x={x} y={height - 8} fontSize="9" fill="#64748b" textAnchor="middle">
              {label}
            </text>
          )
        })}
        {series.map((entry) => (
          <g key={entry.name}>
            <polyline
              points={pointsFor(entry.values)}
              fill="none"
              stroke={PALETTE[entry.color] ?? PALETTE.teal}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {entry.values.map((value, index) => {
              const x = padding.left + (pointCount > 1 ? stepX * index : innerWidth / 2)
              const y = padding.top + innerHeight - ((Number(value) || 0) / max) * innerHeight
              return <circle key={`${entry.name}-${labels[index]}`} cx={x} cy={y} r="3" fill={PALETTE[entry.color] ?? PALETTE.teal} />
            })}
          </g>
        ))}
      </svg>
      <Group gap="lg" justify="center">
        {series.map((entry) => (
          <Group key={entry.name} gap={6}>
            <Box w={10} h={10} style={{ borderRadius: 999, background: PALETTE[entry.color] ?? PALETTE.teal }} />
            <Text size="xs" c="dimmed">{entry.name}</Text>
          </Group>
        ))}
      </Group>
    </Stack>
  )
}

export function DonutChart({ data = [], centerValue, centerLabel, size = 160, emptyLabel = '' }) {
  const total = data.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0)
  if (total <= 0) return <Text c="dimmed" size="sm">{emptyLabel}</Text>

  const radius = 60
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <Group justify="center" align="center" gap="xl" wrap="wrap">
      <Box style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label="donut chart">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="18" />
          {data.map((entry) => {
            const value = Number(entry.value) || 0
            if (value <= 0) return null
            const length = (value / total) * circumference
            const dash = `${length} ${circumference - length}`
            const element = (
              <circle
                key={entry.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={PALETTE[entry.color] ?? PALETTE.teal}
                strokeWidth="18"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform="rotate(-90 80 80)"
                strokeLinecap="butt"
              />
            )
            offset += length
            return element
          })}
        </svg>
        <Stack gap={0} align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
          <Text fw={800} fz={24}>{centerValue ?? total}</Text>
          <Text size="xs" c="dimmed" ta="center" px={6}>{centerLabel}</Text>
        </Stack>
      </Box>
      <Stack gap={6}>
        {data.map((entry) => (
          <Group key={entry.label} gap="xs" wrap="nowrap">
            <Box w={10} h={10} style={{ borderRadius: 999, background: PALETTE[entry.color] ?? PALETTE.teal, flexShrink: 0 }} />
            <Text size="xs" style={{ flex: 1 }}>{entry.label}</Text>
            <Text size="xs" fw={700}>{Number(entry.value) || 0}</Text>
          </Group>
        ))}
      </Stack>
    </Group>
  )
}
