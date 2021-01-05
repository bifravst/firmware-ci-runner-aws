import { CommandDefinition } from './CommandDefinition'
import { IoTClient } from '@aws-sdk/client-iot'
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
		console.log('')
		await wait({
			iot: new IoTClient({
				region,
			}),
			interval,
			timeoutInMinutes: timeout,
			jobId,
		})
	},
	help: 'Wait for a job to complete',
})
