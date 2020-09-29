const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const { promises: fs } = require('fs')
const chalk = require('chalk')
const awsIot = require('aws-iot-device-sdk')
const { spawn } = require('child_process')
const os = require('os')
const path = require('path')
const { v4 } = require('uuid')

const host = 'a3ui73qrzbn6xp-ats.iot.eu-central-1.amazonaws.com'
const clientId = 'firmware-ci-01'

const jobDefaults = {
	timeoutInMinutes: 2,
}

const stringify = (a) => (typeof a === 'object' ? JSON.stringify(a) : a)

const isUndefined = (a) => a === null || a === undefined

const warn = (...args) =>
	console.warn(
		chalk.grey(`[${new Date().toISOString()}]`),
		...args.map((arg) => chalk.yellow(stringify(arg))),
	)
const progress = (...args) =>
	console.info(
		chalk.grey(`[${new Date().toISOString()}]`),
		...args.map((arg) => chalk.blue(stringify(arg))),
		chalk.blue.dim('...'),
	)
const success = (...args) =>
	console.info(
		chalk.grey(`[${new Date().toISOString()}]`),
		...args.map((arg) => chalk.green(stringify(arg))),
	)
const debug = (...args) =>
	console.debug(
		chalk.grey(`[${new Date().toISOString()}]`),
		...args.map((arg) => chalk.magenta(stringify(arg))),
	)

const listDevices = async () => {
	const devs = await fs.readdir('/dev')
	return devs.filter((s) => s.startsWith('ttyACM')).map((s) => `/dev/${s}`)
}

const connect = (connections, onIMEI) => (device) => {
	progress(`Connecting to`, device)
	const port = new SerialPort(device, { baudRate: 115200, lock: false })
	const parser = port.pipe(new Readline({ delimiter: '\n' }))

	const end = () => {
		progress(device, 'closing port')
		port.close()
		success(device, 'port closed')
	}

	port.on('open', () => {
		success(device, `connected`)
	})
	parser.on('data', (data) => {
		if (!connections[device].isDK) {
			debug(device, data)
			connections[device].log.push(`${(new Date()).toISOString()}\t${device}\t${data.trimEnd()}`)
		}
		if (connections[device].ATCmdResult) {
			if (data === 'OK\r') {
				const IMEI = [...connections[device].ATCmdResult].join('')
				success(device, 'IMEI', IMEI)
				connections[device].ATCmdResult = null
				connections[device].IMEI = parseInt(IMEI, 10)
				onIMEI(connections[device].IMEI)
				return
			} else if (data === 'ERROR\r') {
				warn(device, 'Failed to query for IMEI')
				connections[device].ATCmdResult = null
				return
			}
			connections[device].ATCmdResult.push(data.trim())
		}
		if (data.includes('DK Uptime is')) {
			if (!connections[device].isDK)
				warn(device, 'is a DK: supressing future output')
			connections[device].isDK = true
		}
		if (data.includes('The AT host sample started')) {
			progress(device, 'AT host is running')
			if (!connections[device].IMEI) {
				port.write('AT+CGSN\r\n', (err) => {
					if (err) {
						warn(device, 'Error on write: ', err.message)
					}
					progress(device, 'AT+CGSN')
					connections[device].ATCmdResult = []
				})
			}
		}
	})
	port.on('close', () => {
		warn(device, 'port closed')
	})
	port.on('error', (err) => {
		warn(device, err.message)
		end()
	})
	return end
}

const connectToDevices = async (onIMEI) => {
	const connections = {}
	const c = connect(connections, onIMEI)
	const serialDevices = await listDevices()
	if (serialDevices.length === 0) {
		warn(`No devices found.`)
	}
	serialDevices.map((device) => {
		connections[device] = {
			end: c(device),
			log: [],
		}
	})
	return connections
}

const seggerFlashScript = (fwFile) => `h 
w4 4001e504 2
w4 4001e50c 1
sleep 100
rx 1000
h
w4 4001e504 1
loadfile ${fwFile}
rx 1000
g
exit`

const flash = async (info, hexfile) => {
	const script = path.join(os.tmpdir(), `${v4()}.script`)
	await fs.writeFile(script, seggerFlashScript(hexfile), 'utf-8')
	progress(`Flash ${info}`, seggerFlashScript(hexfile))
	return new Promise((resolve, reject) => {
		const flash = spawn('JLinkExe', [
			'-device',
			'nrf9160',
			'-if',
			'SWD',
			'-speed',
			'1000',
			script,
		])
		const log = []
		flash.stdout.on('data', (data) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s) => s.length)
				.map((s) => {
					progress(`Flash ${info}`, s)
					log.push(s)
				})
		})

		flash.stderr.on('data', (data) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s) => s.length)
				.map((s) => warn(`Flash ${info}`, s))
		})

		flash.on('exit', () => {
			if (log.join('\n').includes('Failed to open file.')) {
				warn(`Flash ${info}`, 'Failed to open file.')
				return reject()
			}
			success(`Flash ${info}`, hexfile)
			resolve(log)
		})
	})
}

const runJob = async (job, hexFile) =>
	new Promise((resolve) => {
		let flashLog;
		connectToDevices(async () => {
			flashLog = await flash('Firmware', hexFile)
			await fs.unlink(hexFile)
		}).then(async (connections) => {
			await flash('AT Host', 'thingy91_at_client_increased_buf.hex')
			setTimeout(async () => {
				warn(job.id, 'Timeout reached.')
				resolve({
					result: {timeout: true,},
					connections,
					flashLog
				})
			}, job.timeoutInMinutes * 60 * 1000)
		})
	})

const download = async (jobId, fw) =>
	new Promise((resolve, reject) => {
		const outfile = path.join(os.tmpdir(), `${jobId}.hex`)
		const reset = spawn('curl', ['-L', '-s', fw, '-o', outfile])
		reset.stdout.on('data', (data) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s) => s.length)
				.map((s) => progress(jobId, 'Download HEX', s))
		})

		reset.stderr.on('data', (data) => {
			data
				.toString()
				.trim()
				.split('\n')
				.filter((s) => s.length)
				.map((s) => warn(jobId, 'Download HEX', s))
		})

		reset.on('exit', (code) => {
			if (code === 0) {
				success(jobId, 'Download HEX', 'succeeded')
				resolve(outfile)
			} else {
				warn(jobId, 'Failed to download', fw)
				reject()
			}
		})
	})

const main = async () => {
	await new Promise((resolve, reject) => {
		const connection = awsIot.jobs({
			keyPath: `./certs/${clientId}-private.pem.key`,
			certPath: `./certs/${clientId}-certificate.pem.crt`,
			caPath: `./certs/AmazonRootCA1.pem`,
			clientId,
			host,
		})

		connection.on('connect', () => {
			success(`Connected to ${host} as ${clientId}.`)
			connection.subscribeToJobs(clientId, async (err, job) => {
				if (isUndefined(err)) {
					progress(
						clientId,
						'default job handler invoked, jobId:',
						job.id.toString(),
					)
					const doc = {
						id: job.id.toString(),
						...jobDefaults,
						...job.document,
					}
					progress(clientId, 'job document', doc)
					job.inProgress({
						status: 'downloading',
						statusDetail: doc.fw,
					})
					const hexFile = await download(job.id.toString(), doc.fw)
					job.inProgress({
						status: 'running',
					})
					const {result, connections, flashLog} = await runJob(doc, hexFile)
					job.succeeded({
						status: 'success',
					})
					console.log(JSON.stringify({
						job,
						result,
					}, null, 2))
					console.log(flashLog.join(
						'\n'
					))
					Object.entries(connections).map(([k, v]) => {
						console.log(k, v.IMEI ? `IMEI: ${v.IMEI}` : '')
						console.log(v.log.join('\n'))
					})
					// Reset FW
					await flash('AT Host', 'thingy91_at_client_increased_buf.hex')
					Object.values(connections).map(({end}) => end())
				} else {
					warn(clientId, err)
				}
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
		})

		connection.on('error', reject)
	})
}

main()
