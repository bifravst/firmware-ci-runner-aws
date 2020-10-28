import { CommandDefinition } from './CommandDefinition'
import { runner } from '../../runner/runner'

export const runCommand = ({
	atClientHexFile,
}: {
	atClientHexFile: string
}): CommandDefinition => ({
	command: 'run <certificateJSON>',
	action: async (certificateJSON) => {
		await runner({ certificateJSON, atClientHexFile })
	},
	help: 'Execute firmware CI jobs',
})
