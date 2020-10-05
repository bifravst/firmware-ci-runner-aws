import * as path from 'path'
import * as os from 'os'
import { spawn } from 'child_process'
import { progress, success, warn } from './log'

/**
 * Downloads and stores a firmware file using curl
 */
export const download = async (jobId: string, fw: string): Promise<string> =>
	new Promise((resolve, reject) => {
		const outfile = path.join(os.tmpdir(), `${jobId}.hex`)
		progress(jobId, 'Downloading HEX file from', fw)
		progress(jobId, 'Downloading HEX file to', outfile)
		const reset = spawn('curl', ['-L', '-s', fw, '-o', outfile])
		reset.stdout.on('data', (data: string) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s) => s.length)
				.map((s) => progress(jobId, 'Download HEX file', s))
		})

		reset.stderr.on('data', (data: string) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s) => s.length)
				.map((s) => warn(jobId, 'Download HEX file', s))
		})

		reset.on('exit', (code) => {
			if (code === 0) {
				success(jobId, 'Download HEX file', 'succeeded')
				resolve(outfile)
			} else {
				warn(jobId, 'Failed to download', fw)
				reject()
			}
		})
	})
