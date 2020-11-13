import { CommandDefinition } from './CommandDefinition'
import { atHostHexFile } from '../../runner/atHostHexFile'
import { runJob } from '../../runner/runJob'
import { promises as fs } from 'fs'
import { download } from '../../runner/download'

export const runFromFileCommand = (): CommandDefinition => ({
	command: 'run-once <device> <jobFile>',
	options: [
		{
			flags: '-t, --thingy',
			description: `Connected DK is a thingy`,
		},
	],
	action: async (device, jobFile, { thingy }) => {
		const doc = JSON.parse(await fs.readFile(jobFile, 'utf-8'))
		const hexFile = await download(doc.id.toString(), doc.fw)
		//await new Promise((resolve) => setTimeout(resolve, 10 * 1000))
		await runJob({
			doc,
			hexFile,
			device,
			atHostHexFile:
				thingy === true ? atHostHexFile.thingy91 : atHostHexFile['9160dk'],
		})
		await fs.unlink(hexFile)
	},
	help: 'Execute one firmware CI job from a file',
})
