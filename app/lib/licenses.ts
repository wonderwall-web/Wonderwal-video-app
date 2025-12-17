type LicenseData = {
  email: string
  device: string | null
}

export const LICENSES = new Map<string, LicenseData>()
