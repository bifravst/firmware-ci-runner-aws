import * as SerialPort from 'serialport'

// eslint-disable-next-line no-control-regex
const trim = (data: string) => data.trim().replace(/\u0000/g, '')

export const atCMD = (
	device: string,
	port: SerialPort,
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	parser: any,
	delimiter: string,
	log?: (...args: string[]) => void,
) => async (cmd: string): Promise<string[]> =>
	new Promise((resolve, reject) => {
		const ATCmdResult: string[] = []
		const dataHandler = (data: string) => {
			log?.('<AT', data)
			const d = trim(data)
			if (d === 'OK') {
				parser.off('data', dataHandler)
				return resolve(ATCmdResult)
			}
			if (d === 'ERROR') {
				parser.off('data', dataHandler)
				return reject(
					new Error(
						`AT command ${cmd} failed on ${device}: ERROR after write.`,
					),
				)
			}
			ATCmdResult.push(d)
		}
		parser.on('data', dataHandler)
		port.write(`${cmd}${delimiter}`, (err) => {
			if (err) {
				parser.off('data', dataHandler)
				return reject(
					new Error(
						`Failed to send AT command ${cmd} failed to ${device}: ${err.message}`,
					),
				)
			}
			log?.('AT>', cmd)
		})
	})
