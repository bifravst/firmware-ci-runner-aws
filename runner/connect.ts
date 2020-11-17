import * as SerialPort from 'serialport'
import * as Readline from '@serialport/parser-readline'
import { progress, success, debug, warn } from './log'
import { atCMD } from './atCMD'
import { flash } from './flash'

export type Connection = {
	end: () => Promise<void>
	at: (cmd: string) => Promise<string[]>
}

export const connect = async ({
	device,
	delimiter,
	atHostHexFile,
}: {
	device: string
	atHostHexFile: string
	delimiter?: string
}): Promise<{
	connection: Connection
	deviceLog: string[]
	onData: (fn: (s: string) => void) => void
}> =>
	new Promise((resolve) => {
		const deviceLog: string[] = []
		progress(`Connecting to`, device)
		const port = new SerialPort(device, { baudRate: 115200, lock: false })
		const parser = port.pipe(new Readline({ delimiter: delimiter ?? '\r\n' }))
		const at = atCMD(device, port, parser, delimiter ?? '\r\n', (...args) => {
			deviceLog.push(
				`${new Date().toISOString()}\t${device}\t${args.join('\t')}`,
			)
			progress(device, ...args)
		})
		const end = async () => {
			await flash('AT Host', atHostHexFile)
			if (!port.isOpen) {
				success(device, 'port is not open')
				return
			}
			progress(device, 'closing port')
			port.close()
			success(device, 'port closed')
		}

		port.on('open', async () => {
			success(device, `connected`)
			void flash('AT Host', atHostHexFile)
		})
		const listeners: ((s: string) => void)[] = []
		parser.on('data', async (data: string) => {
			debug(device, data)
			deviceLog.push(
				`${new Date().toISOString()}\t${device}\t${data.trimEnd()}`,
			)
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
			warn(device, 'port closed')
		})
		port.on('error', (err) => {
			warn(device, err.message)
			void end()
		})
	})
