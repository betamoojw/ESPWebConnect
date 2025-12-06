// Minimal ESP8266 metadata helper (constants mirrored from legacy target for reference)
export const CHIP_NAME = 'ESP8266';
export const IMAGE_CHIP_ID = 0xfff0c101;
export const EFUSE_BASE = 0x3ff00050;
export const MAC_EFUSE_REG = EFUSE_BASE;
export const UART_CLKDIV_REG = 0x60000014;
export const UART_CLKDIV_MASK = 0xfffff;
export const UART_DATE_REG_ADDR = 0x60000078;
export const FLASH_WRITE_SIZE = 0x400;
export const BOOTLOADER_FLASH_OFFSET = 0x0;

type Loader = {
  chipName?: string;
  chipRevision?: number;
  macAddr?: () => number[];
};

export async function readEsp8266Metadata(loader: Loader) {
  const mac = typeof loader.macAddr === 'function' ? safeMac(loader) : undefined;
  return {
    description: loader.chipName ?? CHIP_NAME,
    features: undefined,
    crystalFreq: 26,
    macAddress: mac,
    pkgVersion: undefined,
    chipRevision: loader.chipRevision ?? undefined,
    majorVersion: undefined,
    minorVersion: undefined,
    flashVendor: undefined,
    psramVendor: undefined,
    flashCap: undefined,
    psramCap: undefined,
    blockVersionMajor: undefined,
    blockVersionMinor: undefined,
  };
}

function safeMac(loader: Loader) {
  try {
    const mac = loader.macAddr?.();
    if (!Array.isArray(mac)) return undefined;
    return mac
      .slice(0, 6)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');
  } catch {
    return undefined;
  }
}
