export const LICENSES = {
  web: {
    code: "web",
    label: "Web Resolution Personal Use",
    price: 9,
  },
  full: {
    code: "full",
    label: "Full Resolution Personal Use",
    price: 19,
  },
} as const;

export type LicenseKey = keyof typeof LICENSES;

export function isValidLicense(value: string): value is LicenseKey {
  return value === "web" || value === "full";
}
