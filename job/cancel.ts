import * as chalk from 'chalk'
import { DeleteJobCommand, IoTClient } from '@aws-sdk/client-iot'

export const cancel = async ({
	iot,
	jobId,
}: {
	iot: IoTClient
	jobId: string
}): Promise<void> => {
	await iot.send(new DeleteJobCommand({ jobId, force: true }))
	console.log(
		chalk.green('Job'),
		chalk.blueBright(jobId),
		chalk.green('cancelled.'),
	)
	console.log()
}
