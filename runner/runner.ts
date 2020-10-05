import * as chalk from 'chalk'
import * as path from 'path'
import { jobs } from 'aws-iot-device-sdk'
import { progress, success } from './log'
import { promises as fs } from 'fs'

const { clientId, brokerHostname, caCert, clientCert, privateKey } = JSON.parse(
	process.env.CREDENTIALS ?? '',
)

const main = async () => {
	const { version } = JSON.parse(
		await fs.readFile(path.join('..', '..', 'package.json'), 'utf-8'),
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
		})

		connection.on('error', reject)

		resolve(connection)
	})
}

void main()
