import type { PeriodType } from '../lib/analytics'
import { periodLabel } from '../lib/analytics'

interface Props {
  type: PeriodType
  period: string
  periods: string[]
  onChange: (type: PeriodType, period: string) => void
}

const TYPE_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

/** Month/Quarter/Year toggle + a dropdown of the periods present in the data. Resets to "All time" on type change. */
export default function PeriodFilter({ type, period, periods, onChange }: Props) {
  return (
    <div className="row gap-wrap">
      <div className="segmented">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={'segmented-btn' + (type === opt.value ? ' active' : '')}
            onClick={() => onChange(opt.value, 'all')}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <select
        className="inline-select"
        value={period}
        onChange={(e) => onChange(type, e.target.value)}
      >
        <option value="all">All time</option>
        {periods.map((p) => (
          <option key={p} value={p}>
            {periodLabel(p, type)}
          </option>
        ))}
      </select>
    </div>
  )
}
