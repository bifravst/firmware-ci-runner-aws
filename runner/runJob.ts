import { flash } from './flash'
import { RunningFirmwareCIJobDocument } from './job'
import { progress, warn } from './log'
import { connect, Connection } from './connect'

export const runJob = async ({
	doc,
	hexFile,
	dkDevice,
}: {
	doc: RunningFirmwareCIJobDocument
	hexFile: string
	dkDevice: string
}): Promise<{
	result: { timeout: boolean }
	connection: Connection
	deviceLog: string[]
	flashLog: string[]
}> => {
	progress(doc.id, `Connecting to ${dkDevice}`)
	const { connection, deviceLog } = connect(dkDevice)
	let flashLog: string[] = []
	const { credentials } = doc
	if (credentials !== undefined) {
		const { secTag, privateKey, clientCert, caCert } = credentials
		progress(doc.id, 'Flashing credentials')
		// Turn off modem
		await connection.at('AT+CFUN=4')
		// 0 – Root CA certificate (ASCII text)
		await connection.at(`AT%CMNG=0,${secTag},0,"${caCert.replace(/\n/g, '')}"`)
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
	// FIXME: implement terminal state critera
	return new Promise((resolve) => {
		setTimeout(async () => {
			warn(doc.id, 'Timeout reached.')
			resolve({
				result: { timeout: true },
				connection,
				deviceLog,
				flashLog,
			})
		}, doc.timeoutInMinutes * 60 * 1000)
	})
}
