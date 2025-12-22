type LicenseData = {
  email: string
  device: string | null
  active: boolean
}

export const LICENSES = new Map<string, LicenseData>()
