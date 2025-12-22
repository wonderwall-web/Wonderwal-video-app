type LicenseData = {
  email: string
  device: string | null
}

export const LICENSES = new Map<string, LicenseData>()

// contoh seed license (boleh dihapus nanti)
LICENSES.set("LIC-OK-123", {
  email: "",
  device: null
})
