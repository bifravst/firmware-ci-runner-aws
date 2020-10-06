import * as chalk from 'chalk'
import * as path from 'path'
import { jobs, job } from 'aws-iot-device-sdk'
import { progress, success, warn } from './log'
import { promises as fs } from 'fs'
import { download } from './download'
import { runJob } from './runJob'
import { flash } from './flash'
import {
	defaultTimeoutInMinutes,
	FirmwareCIJobDocument,
	RunningFirmwareCIJobDocument,
} from './job'
import { uploadToS3 } from './publishReport'

const { clientId, brokerHostname, caCert, clientCert, privateKey } = JSON.parse(
	process.env.CREDENTIALS ?? '',
)

const isUndefined = (a?: any): boolean => a === null || a === undefined

const main = async () => {
	const { version } = JSON.parse(
		await fs.readFile(
			path.normalize(path.join(__dirname, '..', '..', 'package.json')),
			'utf-8',
		),
	)

	console.log(chalk.grey('  Firmware CI version: '), chalk.yellow(version))
	console.log(
		chalk.grey('  MQTT endpoint:       '),
		chalk.yellow(brokerHostname),
	)
	console.log(chalk.grey('  Device ID:           '), chalk.yellow(clientId))
	console.log()

	await new Promise((resolve, reject) => {
		progress('Connecting')
		const connection = new jobs({
			privateKey: Buffer.from(privateKey.replace(/\\n/g, '\n')),
			clientCert: Buffer.from(clientCert.replace(/\\n/g, '\n')),
			caCert: Buffer.from(caCert.replace(/\\n/g, '\n')),
			clientId,
			host: brokerHostname,
		})

		connection.on('connect', () => {
			success(`Connected to ${brokerHostname} as ${clientId}.`)
			connection.subscribeToJobs(
				clientId,
				// There is a bug in the TypeScript definition
				// @ts-ignore
				async (err: Error, job: job): Promise<void> => {
					if (isUndefined(err)) {
						progress(
							clientId,
							'default job handler invoked, jobId:',
							job.id.toString(),
						)
						const doc: RunningFirmwareCIJobDocument = {
							id: job.id.toString(),
							...(job.document as FirmwareCIJobDocument),
							timeoutInMinutes: defaultTimeoutInMinutes,
						}
						progress(clientId, 'job document', doc)
						job.inProgress({
							progress: `downloading ${doc.fw}`,
						})
						const hexFile = await download(job.id.toString(), doc.fw)
						job.inProgress({
							progress: 'running',
						})
						const report: Record<string, any> = {}
						try {
							const { result, connections, deviceLog, flashLog } = await runJob(
								doc,
								hexFile,
							)
							job.succeeded({
								progress: 'success',
							})
							success(job.id, 'success')
							report.result = result
							report.flashLog = flashLog
							report.deviceLog = deviceLog
							report.connections = connections
							// Reset FW
							await flash('AT Host', 'thingy91_at_client_increased_buf.hex')
							Object.values(connections).map(({ end }) => end())
						} catch (err) {
							warn(job.id, 'failed', err.message)
							report.error = err
							job.failed({
								progress: err.message,
							})
						}
						// Publish report
						progress(`Publishing report to`, doc.reportUrl)
						await uploadToS3(doc.reportPublishUrl, report)
						// Remove hexfile
						await fs.unlink(hexFile)
						success(job.id, 'HEX file deleted')
					} else {
						warn(clientId, err)
					}
				},
			)
		})

		connection.startJobNotifications(clientId, (err) => {
			if (isUndefined(err)) {
				success(clientId, `registered for jobs.`)
				resolve(connection)
			} else {
				warn(clientId, err)
				reject(err)
			}
		})

		connection.on('error', reject)
	})
}

void main()
