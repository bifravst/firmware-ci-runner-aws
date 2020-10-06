import { v4 } from 'uuid'
import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { S3, Iot } from 'aws-sdk'
import { promises as fs } from 'fs'
import { FirmwareCIJobDocument } from '../../runner/job'

const queryString = (s: Record<string, any>): string =>
	Object.entries(s)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&')

const defaultTarget = 'thingy91_nrf9160ns'
const defaultNetwork = 'ltem'
const defaultSecTag = 42

export const scheduleJobCommand = ({
	bucketName,
	region,
	ciDeviceArn,
}: {
	bucketName: string
	region: string
	ciDeviceArn: string
}): CommandDefinition => ({
	command: 'schedule <firmwareUrl> <certificateJSON>',
	options: [
		{
			flags: '-t, --target <target>',
			description: `Target board, default: ${defaultTarget}`,
		},
		{
			flags: '-n, --network <network>',
			description: `Target network, default: ${defaultNetwork}`,
		},
		{
			flags: '-s, --sec-tag <secTag>',
			description: `Credentials secTag, default: ${defaultSecTag}`,
		},
	],
	action: async (firmwareUrl, certificateJSON, { target, network, secTag }) => {
		const jobId = v4()
		console.log('')
		console.log(chalk.gray('  Job ID:    '), chalk.yellow(jobId))
		const s3 = new S3({
			region,
		})
		const { url, fields } = s3.createPresignedPost({
			Bucket: bucketName,
			Fields: {
				key: `${jobId}.json`,
			},
		})

		const { caCert, clientCert, privateKey } = JSON.parse(
			await fs.readFile(certificateJSON, 'utf-8'),
		)

		const jobDocument: FirmwareCIJobDocument = {
			reportPublishUrl: `${url}?${queryString(fields)}`,
			reportUrl: `https://${bucketName}.s3.${region}.amazonaws.com/${jobId}.json`,
			fw: firmwareUrl,
			target: `${target ?? defaultTarget}:${network ?? defaultNetwork}`,
			credentials: {
				secTag: secTag === undefined ? defaultSecTag : parseInt(secTag, 10),
				privateKey,
				clientCert,
				caCert,
			},
		}

		console.log(jobDocument)

		const iot = new Iot({
			region,
		})
		await iot
			.createJob({
				jobId,
				targets: [ciDeviceArn],
				document: JSON.stringify(jobDocument),
				description: `Firmware CI job for a ${target ?? defaultTarget} with ${
					network ?? defaultNetwork
				}`,
				targetSelection: 'SNAPSHOT',
				timeoutConfig: {
					inProgressTimeoutInMinutes: 60,
				},
			})
			.promise()

		console.log(
			chalk.green('Job'),
			chalk.blueBright(jobId),
			chalk.green('created.'),
		)
	},
	help: 'Schedules a new Firmware CI job.',
})
