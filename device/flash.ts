import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import * as path from 'path'
import * as os from 'os'
import { v4 } from 'uuid'

const seggerFlashScript = (fwFile: string) => `h 
w4 4001e504 2
w4 4001e50c 1
sleep 100
rx 1000
h
w4 4001e504 1
loadfile ${fwFile}
rx 1000
g
exit`

/**
 * Implements flashing firmware using Segger JLink
 */
export const flash = async ({
	hexfile,
	progress,
	success,
	warn,
}: {
	hexfile: string
	progress?: (...args: string[]) => void
	success?: (...args: string[]) => void
	warn?: (...args: string[]) => void
}): Promise<string[]> => {
	const script = path.join(os.tmpdir(), `${v4()}.script`)
	await fs.writeFile(script, seggerFlashScript(hexfile), 'utf-8')
	progress?.(seggerFlashScript(hexfile))
	return new Promise((resolve, reject) => {
		const flash = spawn('JLinkExe', [
			'-device',
			'nrf9160',
			'-if',
			'SWD',
			'-speed',
			'1000',
			script,
		])
		const log: string[] = []
		let timedOut = false
		const t = setTimeout(() => {
			flash.kill('SIGHUP')
			timedOut = true
			return reject(
				new Error(`Timeout while waiting for flashing to complete.`),
			)
		}, 60 * 1000)
		flash.stdout.on('data', (data) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s: string) => s.length)
				.map((s: string) => {
					progress?.(s)
					log.push(s)
				})
		})

		flash.stderr.on('data', (data) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s: string) => s.length)
				.map((s: string) => warn?.(s))
		})

		flash.on('exit', () => {
			clearTimeout(t)
			if (log.join('\n').includes('Failed to open file.')) {
				warn?.('Failed to open file.')
				return reject()
			}
			if (log.join('\n').includes('Script processing completed.')) {
				success?.(hexfile)
				resolve(log)
			} else if (!timedOut) {
				reject(new Error('Flashing did not succeed for unknown reasons.'))
			}
		})
	})
}
