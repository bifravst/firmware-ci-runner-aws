import { v4 } from 'uuid'
import * as chalk from 'chalk'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { CreateJobCommand, IoTClient } from '@aws-sdk/client-iot'
import { promises as fs } from 'fs'
import { FirmwareCIJobDocument } from './job'
import { S3Client } from '@aws-sdk/client-s3'

const queryString = (s: Record<string, any>): string =>
	Object.entries(s)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&')

export const schedule = async ({
	firmwareUrl,
	certificateJSON,
	target,
	network,
	secTag,
	bucketName,
	region,
	s3,
	ciDeviceArn,
	jobId,
	iot,
	timeoutInMinutes,
	abortOn,
	endOn,
}: {
	iot: IoTClient
	firmwareUrl: string
	certificateJSON: string
	target: string
	network: string
	secTag: number
	bucketName: string
	region: string
	s3: S3Client
	ciDeviceArn: string
	jobId?: string
	timeoutInMinutes?: number
	abortOn?: string[]
	endOn?: string[]
}): Promise<FirmwareCIJobDocument> => {
	jobId = jobId ?? v4()
	console.log('')
	const { url, fields } = await createPresignedPost(s3, {
		Bucket: bucketName,
		Key: `${jobId}.json`,
	})

	const { caCert, clientCert, privateKey } = JSON.parse(
		await fs.readFile(certificateJSON, 'utf-8'),
	)

	const jobDocument: FirmwareCIJobDocument = {
		reportPublishUrl: `${url}?${queryString(fields)}`,
		reportUrl: `https://${bucketName}.s3.${region}.amazonaws.com/${jobId}.json`,
		fw: firmwareUrl,
		target: `${target}:${network}`,
		expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
		credentials: {
			secTag,
			privateKey,
			clientCert,
			caCert,
		},
		timeoutInMinutes,
		abortOn,
		endOn,
	}

	await iot.send(
		new CreateJobCommand({
			jobId,
			targets: [ciDeviceArn],
			document: JSON.stringify(jobDocument),
			description: `Firmware CI job for a ${target} with ${network}`,
			targetSelection: 'SNAPSHOT',
			timeoutConfig: {
				inProgressTimeoutInMinutes: 60,
			},
		}),
	)

	console.log(
		chalk.green('Job'),
		chalk.blueBright(jobId),
		chalk.green('created.'),
	)
	console.log()
	console.log(chalk.green('You can observe the job execution using:'))
	console.log(chalk.greenBright('node cli wait'), chalk.blueBright(jobId))
	return jobDocument
}
