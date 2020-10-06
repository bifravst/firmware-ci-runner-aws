import * as SerialPort from 'serialport'
import { progress, warn } from './log'

// eslint-disable-next-line no-control-regex
const trim = (data: string) => data.trim().replace(/\u0000/g, '')

export const atCMD = (
	device: string,
	port: SerialPort,
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	parser: any,
	delimiter: string,
) => async (cmd: string): Promise<string[]> =>
	new Promise((resolve, reject) => {
		const ATCmdResult: string[] = []
		const dataHandler = (data: string) => {
			progress(device, '<AT', data)
			const d = trim(data)
			if (d === 'OK') {
				parser.off('data', dataHandler)
				return resolve(ATCmdResult)
			}
			ATCmdResult.push(d)
		}
		parser.on('data', dataHandler)
		port.write(`${cmd}${delimiter}`, (err) => {
			if (err) {
				warn(device, 'Error on write: ', err.message)
				return reject(err)
			}
			progress(device, 'AT>', cmd)
		})
	})
