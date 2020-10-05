import { connectToDevices } from './connectToDevices'
import { flash } from './flash'
import { RunningFirmwareCIJobDocument } from './job'
import { warn } from './log'
import { promises as fs } from 'fs'
import { Connection } from './connect'

export const runJob = async (
	job: RunningFirmwareCIJobDocument,
	hexFile: string,
): Promise<{
	result: { timeout: boolean }
	connections: Record<string, Connection>
	flashLog: string[]
}> =>
	new Promise((resolve, reject) => {
		let flashLog: string[] = []
		connectToDevices(async () => {
			flashLog = await flash('Firmware', hexFile)
			await fs.unlink(hexFile)
		})
			.then(async (connections) => {
				await flash('AT Host', 'thingy91_at_client_increased_buf.hex')
				setTimeout(async () => {
					warn(job.id, 'Timeout reached.')
					resolve({
						result: { timeout: true },
						connections,
						flashLog,
					})
				}, job.timeoutInMinutes * 60 * 1000)
			})
			.catch(reject)
	})
