import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { Iot } from 'aws-sdk'
import {
	waitDefaultIntervalInSeconds,
	waitDefaultTimeoutInMinutes,
	wait,
} from '../../job/wait'

export const waitForJobCommand = ({
	region,
}: {
	region: string
}): CommandDefinition => ({
	command: 'wait <jobId>',
	options: [
		{
			flags: '-t, --timout <timeout>',
			description: `Timeout in minutes, default: ${waitDefaultTimeoutInMinutes}`,
		},
		{
			flags: '-i, --interval <interval>',
			description: `Interval in seconds, default: ${waitDefaultIntervalInSeconds}`,
		},
	],
	action: async (jobId, { timeout, interval }) => {
		console.log(chalk.gray('  Job ID:    '), chalk.yellow(jobId))
		console.log('')
		const iot = new Iot({
			region,
		})

		await wait({
			iot,
			interval,
			timeoutInMinutes: timeout,
			jobId,
		})
	},
	help: 'Wait for a job to complete',
})
