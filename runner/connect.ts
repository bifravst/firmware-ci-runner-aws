import * as SerialPort from 'serialport'
import * as Readline from '@serialport/parser-readline'
import { progress, success, debug, warn } from './log'
import { atCMD } from './atCMD'

export type Connection = {
	isDK?: boolean
	IMEI?: number
	end: () => void
	at: (cmd: string) => Promise<string[]>
}

export const connect = (
	device: string,
	delimiter = '\r\n',
): { connection: Connection; deviceLog: string[] } => {
	const deviceLog: string[] = []
	progress(`Connecting to`, device)
	const port = new SerialPort(device, { baudRate: 115200, lock: false })
	const parser = port.pipe(new Readline({ delimiter }))
	const at = atCMD(device, port, parser, delimiter, (...args) => {
		deviceLog.push(`${new Date().toISOString()}\t${device}\t${args.join('\t')}`)
		progress(device, ...args)
	})
	const end = () => {
		if (!port.isOpen) {
			success(device, 'port is not open')
			return
		}
		progress(device, 'closing port')
		port.close()
		success(device, 'port closed')
	}

	port.on('open', () => {
		success(device, `connected`)
	})
	parser.on('data', async (data: string) => {
		debug(device, data)
		deviceLog.push(`${new Date().toISOString()}\t${device}\t${data.trimEnd()}`)
	})
	port.on('close', () => {
		warn(device, 'port closed')
	})
	port.on('error', (err) => {
		warn(device, err.message)
		end()
	})
	return {
		connection: {
			at,
			end,
		},
		deviceLog,
	}
}
