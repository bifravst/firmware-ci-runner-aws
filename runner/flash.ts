import { promises as fs } from 'fs'
import { spawn } from 'child_process'
import { progress, warn, success } from './log'
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

export const flash = async (
	info: string,
	hexfile: string,
): Promise<string[]> => {
	const script = path.join(os.tmpdir(), `${v4()}.script`)
	await fs.writeFile(script, seggerFlashScript(hexfile), 'utf-8')
	progress(`Flash ${info}`, seggerFlashScript(hexfile))
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
		flash.stdout.on('data', (data) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s: string) => s.length)
				.map((s: string) => {
					progress(`Flash ${info}`, s)
					log.push(s)
				})
		})

		flash.stderr.on('data', (data) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s: string) => s.length)
				.map((s: string) => warn(`Flash ${info}`, s))
		})

		flash.on('exit', () => {
			if (log.join('\n').includes('Failed to open file.')) {
				warn(`Flash ${info}`, 'Failed to open file.')
				return reject()
			}
			success(`Flash ${info}`, hexfile)
			resolve(log)
		})
	})
}
