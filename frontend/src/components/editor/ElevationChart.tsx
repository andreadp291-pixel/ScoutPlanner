import { useEffect, useMemo, useRef, useState } from 'react'
import { climb, indexAtKm, niceStep, niceTicks, resample, type ProfilePoint } from '../../lib/elevation'

const H = 220
const M = { top: 22, right: 14, bottom: 28, left: 46 }
const MIN_SPAN_M = 60 // percorsi quasi piatti: niente dislivelli finti ingigantiti

const fmt = (n: number, digits = 0) => n.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })

// Profilo altimetrico: assi con valori tondi, linea smussata, mirino che segue puntatore/dito/frecce
// e resta sincronizzato con il segnaposto sulla mappa (scrubKm).
export function ElevationChart({
  profile,
  scrubKm,
  onScrubKmChange,
}: {
  profile: ProfilePoint[]
  scrubKm: number
  onScrubKmChange: (km: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  const [active, setActive] = useState(false)
  const hasChart = profile.length >= 2
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(el.clientWidth, 240)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasChart])

  const innerW = w - M.left - M.right
  const innerH = H - M.top - M.bottom
  // un punto ogni ~3 px: abbastanza fitto da sembrare continuo, abbastanza largo da togliere il rumore
  const pts = useMemo(() => resample(profile, Math.max(2, Math.round(innerW / 3))), [profile, innerW])

  // Salita cumulata con la stessa soglia della «Salita» del riepilogo.
  const cumGain = useMemo(() => climb(profile.map((p) => p.ele)).cum, [profile])

  if (!hasChart) return null

  const maxKm = pts[pts.length - 1].km || 1
  let lo = Infinity
  let hi = -Infinity
  let iMax = 0
  let iMin = 0
  pts.forEach((p, i) => {
    if (p.ele > hi) { hi = p.ele; iMax = i }
    if (p.ele < lo) { lo = p.ele; iMin = i }
  })
  const pad = Math.max(0, MIN_SPAN_M - (hi - lo)) / 2
  const y = niceTicks(lo - pad, hi + pad, 4)
  const xStep = niceStep(maxKm / Math.max(2, Math.floor(innerW / 90)))
  const xTicks: number[] = []
  // l'ultima tacca lascia posto all'unità «km» in fondo all'asse
  for (let k = 0; k <= maxKm + 1e-9; k += xStep) if (k === 0 || k / maxKm < 1 - 34 / innerW) xTicks.push(Number(k.toFixed(6)))

  const toX = (km: number) => M.left + (km / maxKm) * innerW
  const toY = (ele: number) => M.top + innerH - ((ele - y.lo) / (y.hi - y.lo)) * innerH
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${toX(p.km).toFixed(1)},${toY(p.ele).toFixed(1)}`).join('')
  const base = M.top + innerH
  const area = `${line}L${toX(maxKm).toFixed(1)},${base}L${M.left},${base}Z`

  // punto sotto il mirino
  const km = Math.min(Math.max(scrubKm, 0), maxKm)
  const i = Math.min(pts.length - 1, Math.round((km / maxKm) * (pts.length - 1)))
  const cur = pts[i]
  const a = pts[Math.max(i - 2, 0)]
  const b = pts[Math.min(i + 2, pts.length - 1)]
  const grade = b.km > a.km ? ((b.ele - a.ele) / ((b.km - a.km) * 1000)) * 100 : 0
  const rawIdx = indexAtKm(profile, km)
  const cx = toX(cur.km)
  const cy = toY(cur.ele)

  const kmFromClientX = (clientX: number, target: Element) => {
    const r = target.getBoundingClientRect()
    return Math.min(Math.max(((clientX - r.left - M.left) / innerW) * maxKm, 0), maxKm)
  }
  const kmLabel = (k: number) => fmt(k, xStep < 1 ? 1 : 0)
  // il riquadro sta dal lato libero del mirino, così non copre il punto letto
  const tipStyle = cx > w / 2 ? { right: w - cx + 12 } : { left: cx + 12 }

  const extreme = (idx: number, above: boolean) => {
    const px = toX(pts[idx].km)
    const py = toY(pts[idx].ele)
    const anchor = px < M.left + 30 ? 'start' : px > w - M.right - 30 ? 'end' : 'middle'
    // sopra/sotto il punto, ma mai fuori dall'area del grafico (lì ci sono le etichette degli assi)
    const up = py - 8
    const down = py + 15
    const labelY = above ? (up > M.top + 4 ? up : down) : down < M.top + innerH - 4 ? down : up
    return (
      <g className="ele-extreme">
        <circle cx={px} cy={py} r={3} />
        <text x={px} y={labelY} textAnchor={anchor}>
          {above ? '▲' : '▼'} {fmt(pts[idx].ele)} m
        </text>
      </g>
    )
  }

  return (
    <div className="ele-chart" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${w} ${H}`}
        width="100%"
        role="slider"
        tabIndex={0}
        aria-label="Profilo altimetrico: usa le frecce per scorrere il percorso"
        aria-valuemin={0}
        aria-valuemax={Number(maxKm.toFixed(2))}
        aria-valuenow={Number(km.toFixed(2))}
        aria-valuetext={`${kmLabel(km)} km, quota ${fmt(cur.ele)} m`}
        onPointerMove={(e) => { setActive(true); onScrubKmChange(kmFromClientX(e.clientX, e.currentTarget)) }}
        onPointerDown={(e) => { setActive(true); onScrubKmChange(kmFromClientX(e.clientX, e.currentTarget)) }}
        onPointerLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? maxKm / 10 : maxKm / 100
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            onScrubKmChange(Math.min(Math.max(km + (e.key === 'ArrowRight' ? step : -step), 0), maxKm))
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault()
            onScrubKmChange(e.key === 'Home' ? 0 : maxKm)
          }
        }}
      >
        <defs>
          <linearGradient id="eleFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="ele-fill-top" />
            <stop offset="100%" className="ele-fill-bottom" />
          </linearGradient>
        </defs>

        {y.ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={w - M.right} y1={toY(t)} y2={toY(t)} className="ele-grid" />
            <text x={M.left - 8} y={toY(t)} dy="0.35em" textAnchor="end" className="ele-axis">
              {fmt(t)}
            </text>
          </g>
        ))}
        <text x={M.left - 8} y={M.top - 10} textAnchor="end" className="ele-axis ele-unit">m</text>
        {xTicks.map((t) => (
          <text key={t} x={toX(t)} y={H - 8} textAnchor={t === 0 ? 'start' : 'middle'} className="ele-axis">
            {kmLabel(t)}
          </text>
        ))}
        <text x={w - M.right} y={H - 8} textAnchor="end" className="ele-axis ele-unit">km</text>

        <path d={area} fill="url(#eleFill)" />
        <path d={line} className="ele-line" />
        {extreme(iMax, true)}
        {iMin !== iMax && extreme(iMin, false)}

        <line x1={cx} x2={cx} y1={M.top} y2={base} className="ele-cursor" />
        <circle cx={cx} cy={cy} r={5} className="ele-dot" />
      </svg>

      {active && (
        <div className="ele-tip" style={tipStyle} aria-hidden="true">
          <div className="ele-tip-title">{fmt(km, 2)} km</div>
          <div><span>Quota</span><strong>{fmt(cur.ele)} m</strong></div>
          <div><span>Pendenza</span><strong>{grade > 0 ? '+' : ''}{fmt(grade, 1)}%</strong></div>
          <div><span>Salita finora</span><strong>+{fmt(cumGain[rawIdx] ?? 0)} m</strong></div>
        </div>
      )}
    </div>
  )
}
