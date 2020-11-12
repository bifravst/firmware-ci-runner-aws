import * as SerialPort from 'serialport'
import * as Readline from '@serialport/parser-readline'
import { progress, success, debug, warn } from './log'
import { atCMD } from './atCMD'
import { listDevices } from './listDevices'
import { flash } from './flash'

type Connection = {
	device: string
	IMEI: number
}
const detectIMEI = ({
	delimiter,
	onIMEI,
}: {
	delimiter?: string
	onIMEI: (connection: Connection) => void
}) => (device: string): { end: () => void } => {
	let IMEI
	progress(`Connecting to`, device)
	const port = new SerialPort(device, { baudRate: 115200, lock: false })
	const parser = port.pipe(new Readline({ delimiter: delimiter ?? '\r\n' }))
	const at = atCMD(device, port, parser, delimiter ?? '\r\n', (...args) => {
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
		if (data.includes('The AT host sample started')) {
			progress(device, 'AT host is running')
			IMEI = parseInt((await at('AT+CGSN')).join(''), 10)
			progress(device, 'IMEI:', IMEI)
			end()
			onIMEI({
				device,
				IMEI,
			})
		}
	})
	port.on('close', () => {
		warn(device, 'port closed')
	})
	port.on('error', (err) => {
		warn(device, err.message)
	})
	progress(device, 'waiting 60 seconds for IMEI')
	return {
		end,
	}
}

export const detectDK = async ({
	delimiter,
	atClientHexFile,
}: {
	delimiter?: string
	atClientHexFile: string
}): Promise<Connection> => {
	const serialDevices = await listDevices()
	if (serialDevices.length === 0) {
		throw new Error(`No serial devices connected.`)
	}
	await flash('AT Host', atClientHexFile)
	return new Promise<Connection>((resolve, reject) => {
		const t = setTimeout(() => {
			connections.map(({ end }) => end())
			warn('Timed out waiting for IMEI.')
			reject()
		}, 60 * 1000)
		const connections = serialDevices.map(
			detectIMEI({
				delimiter,
				onIMEI: (connection) => {
					clearTimeout(t)
					connections.map(({ end }) => end())
					resolve(connection)
				},
			}),
		)
	})
}
