import { CommandDefinition } from './CommandDefinition'
import { runner } from '../../runner/runner'

export const runCommand = (): CommandDefinition => ({
	command: 'run <certificateJSON>',
	action: async (certificateJSON) => {
		await runner({ certificateJSON })
	},
	help: 'Execute firmware CI jobs',
})
