import {
	flash,
	connect,
	Connection,
	flashCredentials,
} from '@bifravst/firmware-ci'
import { RunningFirmwareCIJobDocument } from '../job/job'
import { allSeen } from './allSeen'
import { progress, warn, log } from './log'

type Result = { timeout: boolean; abort: boolean }

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
	result: Result
	connection: Connection
	deviceLog: string[]
	flashLog: string[]
}> => {
	progress(doc.id, `Connecting to ${device}`)
	const { connection, deviceLog, onData } = await connect({
		device: device,
		atHostHexfile,
		onEnd: async () => {
			await flash({
				hexfile: atHostHexfile,
				...log('Resetting device with AT Host'),
			})
		},
		...log(),
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
	progress(doc.id, `Setting timeout to ${doc.timeoutInMinutes} minutes`)
	return new Promise((resolve) => {
		let done = false
		const t = setTimeout(async () => {
			done = true
			warn(doc.id, 'Timeout reached.')
			await connection.end()
			resolve({
				result: { timeout: true, abort: false },
				connection,
				deviceLog,
				flashLog,
			})
		}, doc.timeoutInMinutes * 60 * 1000)

		const terminateOn = (type: string, result: Result, s: string[]) => {
			progress(
				doc.id,
				`<${type}>`,
				`Setting up ${type} traps. Job will terminate if output contains:`,
			)
			s?.map((s) => progress(doc.id, `<${type}>`, s))
			const terminateCheck = allSeen(s)
			onData(async (data) => {
				s?.forEach(async (s) => {
					if (data.includes(s)) {
						warn(doc.id, `<${type}>`, 'Termination criteria seen:', data)
					}
				})
				if (terminateCheck(data)) {
					if (!done) {
						done = true
						warn(
							doc.id,
							`<${type}>`,
							'All termination criteria have been seen.',
						)
						clearTimeout(t)
						await connection.end()
						resolve({
							result,
							connection,
							deviceLog,
							flashLog,
						})
					}
				}
			})
		}

		if (doc.abortOn !== undefined)
			terminateOn(
				'abortOn',
				{
					abort: true,
					timeout: false,
				},
				doc.abortOn,
			)

		if (doc.endOn !== undefined)
			terminateOn(
				'endOn',
				{
					abort: false,
					timeout: false,
				},
				doc.endOn,
			)
	})
}
