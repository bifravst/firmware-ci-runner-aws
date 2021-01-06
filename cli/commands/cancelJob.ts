import { CommandDefinition } from './CommandDefinition'
import { IoTClient } from '@aws-sdk/client-iot'
import { cancel } from '../../job/cancel'

export const cancelJobCommand = ({
	region,
}: {
	region: string
}): CommandDefinition => ({
	command: 'cancel <jobId>',
	action: async (jobId) => {
		console.log('')
		await cancel({
			iot: new IoTClient({
				region,
			}),
			jobId,
		})
	},
	help: 'Cancel the job',
})
