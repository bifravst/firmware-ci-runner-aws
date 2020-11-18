import { CommandDefinition } from './CommandDefinition'
import { atHostHexfile } from '../../at_client'
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
		const hexfile = await download(doc.id.toString(), doc.fw)
		await runJob({
			doc,
			hexfile,
			device,
			atHostHexfile:
				thingy === true ? atHostHexfile.thingy91 : atHostHexfile['9160dk'],
		})
		await fs.unlink(hexfile)
	},
	help: 'Execute one firmware CI job from a file',
})
