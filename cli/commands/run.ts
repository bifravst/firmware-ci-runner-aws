import { CommandDefinition } from './CommandDefinition'
import { runner } from '../../runner/runner'
import { atHostHexFile } from '../../runner/atHostHexFile'

export const runCommand = (): CommandDefinition => ({
	command: 'run <device> <certificateJSON>',
	options: [
		{
			flags: '-t, --thingy',
			description: `Connected DK is a thingy`,
		},
	],
	action: async (device, certificateJSON, { thingy }) => {
		await runner({
			certificateJSON,
			atHostHexFile:
				thingy === true ? atHostHexFile.thingy91 : atHostHexFile['9160dk'],
			device,
		})
	},
	help: 'Execute firmware CI jobs',
})
