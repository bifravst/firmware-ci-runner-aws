import { connectToDevices } from './connectToDevices'
import { flash } from './flash'
import { RunningFirmwareCIJobDocument } from './job'
import { progress, warn } from './log'
import { Connection } from './connect'

export const runJob = async (
	job: RunningFirmwareCIJobDocument,
	hexFile: string,
): Promise<{
	result: { timeout: boolean }
	connections: Record<string, Connection>
	deviceLog: string[]
	flashLog: string[]
}> =>
	new Promise((resolve, reject) => {
		let flashLog: string[] = []
		connectToDevices({
			onIMEI: async (connection) => {
				const { credentials } = job
				if (credentials !== undefined) {
					const { secTag, privateKey, clientCert, caCert } = credentials
					progress(job.id, 'Flashing credentials')
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
				await flash('AT Host', 'thingy91_at_client_increased_buf.hex')
				setTimeout(async () => {
					warn(job.id, 'Timeout reached.')
					resolve({
						result: { timeout: true },
						connections,
						deviceLog,
						flashLog,
					})
				}, job.timeoutInMinutes * 60 * 1000)
			})
			.catch(reject)
	})
