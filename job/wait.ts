import * as chalk from 'chalk'
import { Iot } from 'aws-sdk'
import { progress, success, warn } from '../runner/log'

export const defaultTimeout = 300
export const defaultInterval = 30

export const wait = async ({
	iot,
	timeout,
	interval,
	jobId,
}: {
	iot: Iot
	timeout?: number
	interval?: number
	jobId: string
}): Promise<void> =>
	new Promise((resolve, reject) => {
		const t = setTimeout(
			() =>
				reject(new Error(`Timed out waiting for job ${jobId} to complete.`)),
			(timeout ?? defaultTimeout) * 1000,
		)
		let i: NodeJS.Timeout | undefined = undefined
		const checkJob = async () => {
			try {
				const { job } = await iot
					.describeJob({
						jobId,
					})
					.promise()
				if (job === undefined) {
					clearTimeout(t)
					if (i !== undefined) clearInterval(i)
					return reject(`Job ${jobId} not found.`)
				}
				if (job.status === 'COMPLETED') {
					progress(job.status)
					clearTimeout(t)
					if (i !== undefined) clearInterval(i)
					if ((job.jobProcessDetails?.numberOfFailedThings ?? 0) > 0) {
						warn(
							`${job.jobProcessDetails?.numberOfFailedThings} failed executions.`,
						)
						return reject(new Error(`Job ${jobId} failed!`))
					}
					success(
						`${job.jobProcessDetails?.numberOfFailedThings} failed executions.`,
					)
					return resolve()
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
			}
		}
		void checkJob()
		i = setInterval(checkJob, (interval ?? defaultInterval) * 1000)
	})
