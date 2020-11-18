import { CommandDefinition } from './CommandDefinition'
import { runner } from '../../runner/runner'
import { atHostHexfile } from '../../at_client'

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
			atHostHexfile:
				thingy === true ? atHostHexfile.thingy91 : atHostHexfile['9160dk'],
			device,
		})
	},
	help: 'Execute firmware CI jobs',
})
