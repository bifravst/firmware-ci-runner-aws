import * as SerialPort from 'serialport'
import * as Readline from '@serialport/parser-readline'
import { atCMD } from './atCMD'
import { flash } from './flash'

export type Connection = {
	end: () => Promise<void>
	at: (cmd: string) => Promise<string[]>
}

/**
 * Connects to a device and prepares it for execution of firmware.
 *
 * This flashes the AT host hexfile on successful connection.
 * Use connection.end() to terminate the connection.
 */
export const connect = async ({
	device,
	delimiter,
	atHostHexfile,
	progress,
	debug,
	warn,
	onEnd,
}: {
	device: string
	atHostHexfile: string
	delimiter?: string
	progress?: (...args: string[]) => void
	debug?: (...args: string[]) => void
	warn?: (...args: string[]) => void
	onEnd?: (port: SerialPort) => Promise<void>
}): Promise<{
	connection: Connection
	deviceLog: string[]
	onData: (fn: (s: string) => void) => void
}> =>
	new Promise((resolve) => {
		const deviceLog: string[] = []
		progress?.(`Connecting to`, device)
		const port = new SerialPort(device, { baudRate: 115200, lock: false })
		const parser = port.pipe(new Readline({ delimiter: delimiter ?? '\r\n' }))
		const at = atCMD({
			device,
			port,
			parser,
			delimiter: delimiter ?? '\r\n',
			progress: (...args) => {
				deviceLog.push(`${new Date().toISOString()}\t${args.join('\t')}`)
				progress?.(device, ...args)
			},
		})
		const end = async () => {
			await onEnd?.(port)
			if (!port.isOpen) {
				warn?.(device, 'port is not open')
				return
			}
			progress?.(device, 'closing port')
			port.close()
			progress?.(device, 'port closed')
		}

		port.on('open', async () => {
			progress?.(device, `connected`)
			void flash({
				hexfile: atHostHexfile,
				debug: (...args: any[]) => debug?.('AT Host', ...args),
				warn: (...args: any[]) => warn?.('AT Host', ...args),
			})
		})
		const listeners: ((s: string) => void)[] = []
		parser.on('data', async (data: string) => {
			debug?.(device, data)
			deviceLog.push(`${new Date().toISOString()}\t${data.trimEnd()}`)
			listeners.map((l) => l(data))
			if (data.includes('The AT host sample started')) {
				resolve({
					connection: {
						at,
						end,
					},
					deviceLog,
					onData: (fn) => {
						listeners.push(fn)
					},
				})
			}
		})
		port.on('close', () => {
			warn?.(device, 'port closed')
		})
		port.on('error', (err) => {
			warn?.(device, err.message)
			void end()
		})
	})
