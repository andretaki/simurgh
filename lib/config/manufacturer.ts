// Manufacturer configuration - can be overridden via environment variables
export const manufacturerConfig = {
  name: process.env.MANUFACTURER_NAME || "ALLIANCE CHEMICAL",
  address: process.env.MANUFACTURER_ADDRESS || "204 S. EDMOND ST. TAYLOR, TEXAS 76574",
  phone: process.env.MANUFACTURER_PHONE || "512-365-6838",
  website: process.env.MANUFACTURER_WEBSITE || "www.alliancechemical.com",
  cageCode: process.env.MANUFACTURER_CAGE_CODE || "1LT50",
};

export type ManufacturerConfig = typeof manufacturerConfig;

export default manufacturerConfig;
