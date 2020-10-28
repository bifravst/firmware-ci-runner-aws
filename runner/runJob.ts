import { connectToDevices } from './connectToDevices'
import { flash } from './flash'
import { RunningFirmwareCIJobDocument } from './job'
import { progress, warn } from './log'
import { Connection } from './connect'

export const runJob = async ({
	doc,
	hexFile,
	atClientHexFile,
}: {
	doc: RunningFirmwareCIJobDocument
	hexFile: string
	atClientHexFile: string
}): Promise<{
	result: { timeout: boolean }
	connections: Record<string, Connection>
	deviceLog: string[]
	flashLog: string[]
}> =>
	new Promise((resolve, reject) => {
		let flashLog: string[] = []
		connectToDevices({
			onIMEI: async (connection) => {
				const { credentials } = doc
				if (credentials !== undefined) {
					const { secTag, privateKey, clientCert, caCert } = credentials
					progress(doc.id, 'Flashing credentials')
					// Turn off modem
					await connection.at('AT+CFUN=4')
					// 0 – Root CA certificate (ASCII text)
					await connection.at(
						`AT%CMNG=0,${secTag},0,"${caCert.replace(/\n/g, '')}"`,
					)
					// 1 – Client certificate (ASCII text)
					await connection.at(
						`AT%CMNG=0,${secTag},1,"${clientCert.replace(/\n/g, '')}"`,
					)
					// 2 – Client private key (ASCII text)
					await connection.at(
						`AT%CMNG=0,${secTag},2,"${privateKey.replace(/\n/g, '')}"`,
					)
					// Turn on modem
					await connection.at('AT+CFUN=1')
				}
				flashLog = await flash('Firmware', hexFile)
			},
		})
			.then(async ([connections, deviceLog]) => {
				await flash('AT Host', atClientHexFile)
				setTimeout(async () => {
					warn(doc.id, 'Timeout reached.')
					resolve({
						result: { timeout: true },
						connections,
						deviceLog,
						flashLog,
					})
				}, doc.timeoutInMinutes * 60 * 1000)
			})
			.catch(reject)
	})
