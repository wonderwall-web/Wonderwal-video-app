type LimitData = {
  count: number
  date: string
}

export const LIMITS = new Map<string, LimitData>()

export function checkLimit(license: string, maxPerDay: number) {
  const today = new Date().toISOString().slice(0, 10)
  const data = LIMITS.get(license)

  if (!data || data.date !== today) {
    LIMITS.set(license, { count: 1, date: today })
    return true
  }

  if (data.count >= maxPerDay) {
    return false
  }

  data.count++
  return true
}
