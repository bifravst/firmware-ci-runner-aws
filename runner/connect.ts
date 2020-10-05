import * as SerialPort from 'serialport'
import * as Readline from '@serialport/parser-readline'
import { progress, success, debug, warn } from './log'

export type Connection = {
	isDK?: boolean
	ATCmdResult: string[]
	log: string[]
	IMEI?: number
	end: () => void
}

export const connect = (
	connections: Record<string, Connection>,
	onIMEI: (IMEI: number) => void,
) => (device: string): void => {
	progress(`Connecting to`, device)
	const port = new SerialPort(device, { baudRate: 115200, lock: false })
	const parser = port.pipe(new Readline({ delimiter: '\n' }))

	const end = () => {
		progress(device, 'closing port')
		port.close()
		success(device, 'port closed')
	}

	port.on('open', () => {
		success(device, `connected`)
	})
	parser.on('data', (data: string) => {
		if (connections[device]?.isDK ?? false) {
			debug(device, data)
			connections[device].log.push(
				`${new Date().toISOString()}\t${device}\t${data.trimEnd()}`,
			)
		}
		if (connections[device].ATCmdResult.length > 0) {
			if (data === 'OK\r') {
				const IMEI = [...connections[device].ATCmdResult].join('')
				success(device, 'IMEI', IMEI)
				connections[device].ATCmdResult = []
				connections[device].IMEI = parseInt(IMEI, 10)
				onIMEI(connections[device].IMEI as number)
				return
			} else if (data === 'ERROR\r') {
				warn(device, 'Failed to query for IMEI')
				connections[device].ATCmdResult = []
				return
			}
			connections[device].ATCmdResult.push(data.trim())
		}
		if (data.includes('DK Uptime is')) {
			if (connections[device]?.isDK ?? false)
				warn(device, 'is a DK: supressing future output')
			connections[device].isDK = true
		}
		if (data.includes('The AT host sample started')) {
			progress(device, 'AT host is running')
			if (connections[device].IMEI === undefined) {
				port.write('AT+CGSN\r\n', (err) => {
					if (err) {
						warn(device, 'Error on write: ', err.message)
					}
					progress(device, 'AT+CGSN')
					connections[device].ATCmdResult = []
				})
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
		end,
		ATCmdResult: [],
		log: [],
	}
}
