import * as chalk from 'chalk'
import {
	DescribeJobCommand,
	GetJobDocumentCommand,
	IoTClient,
	Job,
} from '@aws-sdk/client-iot'
import { progress, success, warn } from '../runner/log'
import { FirmwareCIJobDocument } from './job'

export const waitDefaultTimeoutInMinutes = 5
export const waitDefaultIntervalInSeconds = 30

export const wait = async ({
	iot,
	timeoutInMinutes,
	interval,
	jobId,
}: {
	iot: IoTClient
	timeoutInMinutes?: number
	interval?: number
	jobId: string
}): Promise<{
	job: Job
	jobDocument: FirmwareCIJobDocument
}> =>
	new Promise((resolve, reject) => {
		const t = setTimeout(
			() =>
				reject(new Error(`Timed out waiting for job ${jobId} to complete.`)),
			(timeoutInMinutes ?? waitDefaultTimeoutInMinutes) * 60 * 1000,
		)
		let i: NodeJS.Timeout | undefined = undefined
		const cleanUp = () => {
			if (i !== undefined) clearInterval(i)
			clearTimeout(t)
		}
		const checkJob = async () => {
			try {
				const { job } = await iot.send(
					new DescribeJobCommand({
						jobId,
					}),
				)
				if (job === undefined) {
					cleanUp()
					throw new Error(`Job ${jobId} not found.`)
				}
				if (job.status === 'COMPLETED') {
					cleanUp()
					progress(job.status)
					if ((job.jobProcessDetails?.numberOfFailedThings ?? 0) > 0) {
						warn(
							`${job.jobProcessDetails?.numberOfFailedThings} failed executions.`,
						)
						return reject(new Error(`Job ${jobId} failed!`))
					}
					success(
						`${job.jobProcessDetails?.numberOfFailedThings} failed executions.`,
					)
					return resolve({
						job,
						jobDocument: JSON.parse(
							(
								await iot.send(
									new GetJobDocumentCommand({
										jobId: job.jobId as string,
									}),
								)
							).document as string,
						) as FirmwareCIJobDocument,
					})
				} else if (job.status === 'DELETION_IN_PROGRESS') {
					cleanUp()
					return reject(new Error(`Job ${jobId} is being deleted.`))
				} else {
					progress(
						chalk.yellow(job.status),
						chalk.blueBright(
							job.jobProcessDetails?.numberOfInProgressThings ?? 0,
						),
						chalk.yellow('things have started the job'),
					)
				}
			} catch (err) {
				warn(chalk.red(err.message))
				cleanUp()
				return reject(new Error(`Job ${jobId} not found.`))
			}
		}
		void checkJob()
		i = setInterval(checkJob, (interval ?? waitDefaultIntervalInSeconds) * 1000)
	})
