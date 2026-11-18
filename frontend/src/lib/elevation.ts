// Calcoli del profilo altimetrico: scale con valori tondi e ricampionamento (smussa il rumore del GPS).

export interface ProfilePoint {
  km: number
  ele: number
}

// Passo "tondo" (1, 2, 2.5, 5 × 10^k) vicino a raw.
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const pow = 10 ** Math.floor(Math.log10(raw))
  const f = raw / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow
}

// Tacche tonde che contengono [min, max], con circa `count` intervalli.
export function niceTicks(min: number, max: number, count: number) {
  const step = niceStep((max - min) / count)
  const lo = Math.floor(min / step) * step
  const hi = Math.max(Math.ceil(max / step) * step, lo + step)
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return { lo, hi, step, ticks }
}

// n punti equidistanti in km; ognuno è la media delle quote nella sua finestra (± mezzo passo).
// `profile` è ordinato per km crescente.
export function resample(profile: ProfilePoint[], n: number): ProfilePoint[] {
  if (profile.length < 2 || n < 2) return profile
  const maxKm = profile[profile.length - 1].km
  const half = maxKm / (n - 1) / 2
  const out: ProfilePoint[] = []
  let start = 0
  for (let i = 0; i < n; i++) {
    const km = (i / (n - 1)) * maxKm
    while (start < profile.length - 1 && profile[start].km < km - half) start++
    let sum = 0
    let cnt = 0
    for (let j = start; j < profile.length && profile[j].km <= km + half; j++) {
      sum += profile[j].ele
      cnt++
    }
    // finestra vuota (punti radi): interpola tra i due vicini
    if (cnt === 0) {
      const b = profile[Math.min(start, profile.length - 1)]
      const a = profile[Math.max(start - 1, 0)]
      const t = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km)
      out.push({ km, ele: a.ele + (b.ele - a.ele) * Math.min(Math.max(t, 0), 1) })
    } else out.push({ km, ele: sum / cnt })
  }
  return out
}

// Salita/discesa con soglia (isteresi): conta un dislivello solo quando la quota si sposta di
// più di `threshold` m (10: tipico rumore GPS ±4 m) dall'ultimo punto di riferimento, così il rumore del GPS non si accumula.
// cum[i] = salita fatta fino al punto i.
export function climb(eles: number[], threshold = 10) {
  let gain = 0
  let loss = 0
  const cum: number[] = []
  let ref = eles[0]
  for (const e of eles) {
    if (e - ref > threshold) {
      gain += e - ref
      ref = e
    } else if (ref - e > threshold) {
      loss += ref - e
      ref = e
    }
    cum.push(gain)
  }
  return { gain, loss, cum }
}

// Primo punto con km >= `km` (ricerca binaria: `points` è ordinato per km).
export function indexAtKm(points: { km: number }[], km: number): number {
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].km < km) lo = mid + 1
    else hi = mid
  }
  return lo
}
