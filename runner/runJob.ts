import { flash } from './flash'
import { RunningFirmwareCIJobDocument } from './job'
import { progress, warn } from './log'
import { connect, Connection } from './connect'

export const runJob = async ({
	doc,
	hexFile,
	atHostHexFile,
	device,
}: {
	doc: RunningFirmwareCIJobDocument
	hexFile: string
	atHostHexFile: string
	device: string
}): Promise<{
	result: { timeout: boolean }
	connection: Connection
	deviceLog: string[]
	flashLog: string[]
}> => {
	progress(doc.id, `Connecting to ${device}`)
	const { connection, deviceLog } = await connect({
		device: device,
		atHostHexFile,
	})
	let flashLog: string[] = []
	const { credentials } = doc
	if (credentials !== undefined) {
		const { secTag, privateKey, clientCert, caCert } = credentials
		progress(doc.id, 'Flashing credentials')
		// Turn off modem
		await connection.at('AT+CFUN=4')
		// 0 – Root CA certificate (ASCII text)
		await connection.at(
			`AT%CMNG=0,${secTag},0,"${caCert.replace(/\n/g, '\r\n')}"`,
		)
		// 1 – Client certificate (ASCII text)
		await connection.at(
			`AT%CMNG=0,${secTag},1,"${clientCert.replace(/\n/g, '\r\n')}"`,
		)
		// 2 – Client private key (ASCII text)
		await connection.at(
			`AT%CMNG=0,${secTag},2,"${privateKey.replace(/\n/g, '\r\n')}"`,
		)
		// Turn on modem
		await connection.at('AT+CFUN=1')
	}
	flashLog = await flash('Firmware', hexFile)
	// FIXME: implement terminal state critera
	progress(doc.id, `Setting timeout to ${doc.timeoutInMinutes} minutes`)
	return new Promise((resolve) => {
		setTimeout(async () => {
			warn(doc.id, 'Timeout reached.')
			await connection.end()
			resolve({
				result: { timeout: true },
				connection,
				deviceLog,
				flashLog,
			})
		}, doc.timeoutInMinutes * 60 * 1000)
	})
}
