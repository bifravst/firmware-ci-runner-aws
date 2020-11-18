import * as chalk from 'chalk'
import { Iot } from 'aws-sdk'
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
	iot: Iot
	timeoutInMinutes?: number
	interval?: number
	jobId: string
}): Promise<{
	job: Iot.Job
	jobDocument: FirmwareCIJobDocument
}> =>
	new Promise((resolve, reject) => {
		const t = setTimeout(
			() =>
				reject(new Error(`Timed out waiting for job ${jobId} to complete.`)),
			(timeoutInMinutes ?? waitDefaultTimeoutInMinutes) * 60 * 1000,
		)
		let i: NodeJS.Timeout | undefined = undefined
		const checkJob = async () => {
			try {
				const { job } = await iot
					.describeJob({
						jobId,
					})
					.promise()
				if (job === undefined) throw new Error(`Job ${jobId} not found.`)
				if (job.status === 'COMPLETED') {
					clearTimeout(t)
					if (i !== undefined) clearInterval(i)
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
								await iot
									.getJobDocument({
										jobId: job.jobId as string,
									})
									.promise()
							).document as string,
						) as FirmwareCIJobDocument,
					})
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
				clearTimeout(t)
				if (i !== undefined) clearInterval(i)
				return reject(new Error(`Job ${jobId} not found.`))
			}
		}
		void checkJob()
		i = setInterval(checkJob, (interval ?? waitDefaultIntervalInSeconds) * 1000)
	})
