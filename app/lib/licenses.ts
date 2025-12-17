// app/lib/licenses.ts
export type LicenseData = {
  email?: string
  device?: string
}

export const LICENSES = new Map<string, LicenseData>()
