import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { Iot } from 'aws-sdk'
import { progress, success, warn } from '../../runner/log'

const defaultTimeout = 300
const defaultInterval = 30

export const waitForJobCommand = ({
	region,
}: {
	region: string
}): CommandDefinition => ({
	command: 'wait <jobId>',
	options: [
		{
			flags: '-t, --timout <timeout>',
			description: `Timeout in seconds, default: ${defaultTimeout}`,
		},
		{
			flags: '-i, --interval <interval>',
			description: `Interval in seconds, default: ${defaultInterval}`,
		},
	],
	action: async (jobId, { timeout, interval }) => {
		console.log(chalk.gray('  Job ID:    '), chalk.yellow(jobId))
		console.log('')
		const iot = new Iot({
			region,
		})

		await new Promise((resolve, reject) => {
			const t = setTimeout(() => reject(), (timeout ?? defaultTimeout) * 1000)
			let i: NodeJS.Timeout | undefined = undefined
			const checkJob = async () => {
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
						return reject(`Job ${jobId} failed!`)
					}
					success(
						`${job.jobProcessDetails?.numberOfFailedThings} failed executions.`,
					)
					return resolve()
				} else {
					progress(chalk.yellow(job.status))
				}
			}
			void checkJob()
			i = setInterval(checkJob, (interval ?? defaultInterval) * 1000)
		})
	},
	help: 'Wait for a job to complete',
})
