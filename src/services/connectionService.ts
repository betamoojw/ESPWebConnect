import { createEsptoolClient } from './esptoolClient';

export async function requestSerialPort(filters?: SerialPortFilter[]) {
  if (!navigator?.serial?.requestPort) {
    throw new Error('Web Serial API not available in this browser.');
  }
  return navigator.serial.requestPort(filters ? { filters } : undefined);
}

export function createConnection(
  port: SerialPort,
  baudrate: number,
  terminal: unknown,
  options: { debugSerial?: boolean; debugLogging?: boolean } = {},
) {
  const client = createEsptoolClient({
    port,
    terminal,
    desiredBaud: baudrate,
    debugSerial: options.debugSerial,
    debugLogging: options.debugLogging,
  });
  return { transport: client.transport, loader: client.loader };
}
