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
	connections: Record<string, Connection>,
	deviceLog: string[],
	onIMEI: (connection: Connection) => void,
	delimiter = '\r\n',
) => (device: string): void => {
	progress(`Connecting to`, device)
	const port = new SerialPort(device, { baudRate: 115200, lock: false })
	const parser = port.pipe(new Readline({ delimiter }))
	const at = atCMD(device, port, parser, delimiter, (...args) => {
		deviceLog.push(`${new Date().toISOString()}\t${device}\t${args.join('\t')}`)
		progress(device, ...args)
	})

	const end = () => {
		progress(device, 'closing port')
		port.close()
		success(device, 'port closed')
	}

	port.on('open', () => {
		success(device, `connected`)
	})
	parser.on('data', async (data: string) => {
		if ((connections[device]?.isDK ?? false) !== true) {
			debug(device, data)
			deviceLog.push(
				`${new Date().toISOString()}\t${device}\t${data.trimEnd()}`,
			)
		}
		if (data.includes('DK Uptime is')) {
			if (connections[device]?.isDK === undefined)
				warn(device, 'is a DK: supressing future output')
			connections[device].isDK = true
		}
		if (data.includes('The AT host sample started')) {
			progress(device, 'AT host is running')
			if (connections[device].IMEI === undefined) {
				connections[device].IMEI = parseInt((await at('AT+CGSN')).join(''), 10)
				progress(device, 'IMEI:', connections[device].IMEI)
				onIMEI(connections[device])
			}
		}
	})
	port.on('close', () => {
		warn(device, 'port closed')
	})
	port.on('error', (err) => {
		warn(device, err.message)
		end()
	})
	connections[device] = {
		at,
		end,
	}
}
