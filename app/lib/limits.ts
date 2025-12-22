type Limit = {
  count: number
  resetAt: number
}

const DAY = 24 * 60 * 60 * 1000
const store = new Map<string, Limit>()

export function checkLimit(license: string, maxPerDay = 4) {
  const now = Date.now()
  const data = store.get(license)

  if (!data || now > data.resetAt) {
    store.set(license, {
      count: 1,
      resetAt: now + DAY
    })
    return { ok: true, left: maxPerDay - 1 }
  }

  if (data.count >= maxPerDay) {
    return { ok: false, left: 0 }
  }

  data.count++
  return { ok: true, left: maxPerDay - data.count }
}
