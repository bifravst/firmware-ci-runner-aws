import { flash } from '../device/flash'
import { RunningFirmwareCIJobDocument } from '../job/job'
import { progress, warn, log } from './log'
import { connect, Connection } from '../device/connect'
import { flashCredentials } from '../device/flashCredentials'

export const runJob = async ({
	doc,
	hexfile,
	atHostHexfile,
	device,
}: {
	doc: RunningFirmwareCIJobDocument
	hexfile: string
	atHostHexfile: string
	device: string
}): Promise<{
	result: { timeout: boolean; abort: boolean }
	connection: Connection
	deviceLog: string[]
	flashLog: string[]
}> => {
	progress(doc.id, `Connecting to ${device}`)
	const { connection, deviceLog, onData } = await connect({
		device: device,
		atHostHexfile,
	})
	let flashLog: string[] = []
	const { credentials } = doc
	if (credentials !== undefined) {
		progress(doc.id, 'Flashing credentials')
		await flashCredentials({
			...credentials,
			...connection,
		})
	}
	flashLog = await flash({
		hexfile,
		...log('Flash Firmware'),
	})
	// FIXME: implement terminal state critera
	progress(doc.id, `Setting timeout to ${doc.timeoutInMinutes} minutes`)
	return new Promise((resolve) => {
		const t = setTimeout(async () => {
			warn(doc.id, 'Timeout reached.')
			await connection.end()
			resolve({
				result: { timeout: true, abort: false },
				connection,
				deviceLog,
				flashLog,
			})
		}, doc.timeoutInMinutes * 60 * 1000)
		if (doc.abortOn !== undefined) {
			progress(
				doc.id,
				'<abortOn>',
				'Setting up abortion criteria traps. Job will abort if output contains:',
			)
			doc.abortOn?.map((s) => progress(doc.id, '<abortOn>', s))
			onData((data) => {
				doc.abortOn?.forEach(async (s) => {
					if (data.includes(s)) {
						warn(doc.id, '<abortOn>', 'Abortion criteria seen:', data)
						clearTimeout(t)
						await connection.end()
						resolve({
							result: {
								abort: true,
								timeout: false,
							},
							connection,
							deviceLog,
							flashLog,
						})
					}
				})
			})
		}
	})
}
