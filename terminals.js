const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const { promises: fs } = require('fs')
const chalk = require('chalk')
const awsIot = require('aws-iot-device-sdk')
const equal = require('fast-deep-equal')
const { spawn } = require('child_process')

const host = 'a3ui73qrzbn6xp-ats.iot.eu-central-1.amazonaws.com'
const clientId = 'device-ci-01'

const stringify = (a) => (typeof a === 'object' ? JSON.stringify(a) : a)

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

const connections = {}

const connect = (device) => {
	progress(`Connecting to`, device)
	const port = new SerialPort(device, { baudRate: 115200, lock: false })
	const parser = port.pipe(new Readline({ delimiter: '\n' }))

	const end = () => {
		progress(device, 'closing port')
		port.close()
		success(device, 'port closed')
		connections[device].connected = false
	}

	port.on('open', () => {
		success(device, `connected`)
		connections[device].connecting = null
		connections[device].connected = true
	})
	parser.on('data', (data) => {
		if (connections[device].ResultBuffer) {
			if (data === 'OK\r') {
				const IMEI = [...connections[device].ResultBuffer].join('')
				success(device, 'IMEI', IMEI)
				connections[device].ResultBuffer = null
				connections[device].IMEI = parseInt(IMEI, 10)
				return
			} else if (data === 'ERROR\r') {
				warn(device, 'Failed to query for IMEI')
				connections[device].ResultBuffer = null
				return
			}
			connections[device].ResultBuffer.push(data.trim())
		}
		if (!connections[device].isDK) debug(device, data)
		if (data.includes('DK Uptime is')) {
			if (!connections[device].isDK)
				warn(device, 'is a DK: supressing future output')
			connections[device].isDK = true
		}
		if (data.includes('The AT host sample started')) {
			progress(device, 'AT host is running')
			connections[device].ATHostRunning = true
			port.write('AT+CGSN\r\n', (err) => {
				if (err) {
					warn(device, 'Error on write: ', err.message)
				}
				progress(device, 'AT+CGSN')
				connections[device].ResultBuffer = []
			})
		}
	})
	port.on('close', () => {
		warn(device, 'port closed')
		connections[device].connected = false
	})
	port.on('error', (err) => {
		warn(device, err.message)
		end()
	})
	return end
}

const connectToDevices = async () => {
	const serialDevices = await listDevices()
	if (serialDevices.length === 0) {
		warn(`No devices found.`)
		return
	}
	serialDevices.map((device) => {
		if (connections[device] !== undefined && connections[device].connected)
			return
		connections[device] = {
			end: connect(device),
			connecting: true,
			connected: null,
			isDK: null,
			ATHostRunning: null,
			IMEI: null,
		}
	})
}

const report = (connections) =>
	Object.entries(connections).reduce((r, [k, v]) => {
		const { end, ...rest } = v
		return { ...r, [k]: rest }
	}, {})

const main = async () => {
	const connection = await new Promise((resolve, reject) => {
		const thingShadows = awsIot.thingShadow({
			keyPath: `./certs/${clientId}-private.pem.key`,
			certPath: `./certs/${clientId}-certificate.pem.crt`,
			caPath: `./certs/AmazonRootCA1.pem`,
			clientId,
			host,
		})

		thingShadows.on('connect', () => {
			success(`Connected to ${host} as ${clientId}.`)
			thingShadows.register(clientId, { ignoreDeltas: true }, () => {
				success(`Registered for shadow.`)
				resolve(thingShadows)
			})
		})

		thingShadows.on('error', reject)
		thingShadows.on('status', (thingName, stat, _, stateObject) =>
			progress('received ' + stat + ' on ' + thingName, stateObject),
		)
	})

	setInterval(connectToDevices, 10000)
	connectToDevices()
	let reported
	setInterval(() => {
		const newReport = report(connections)
		if (!equal(newReport, reported)) {
			progress(newReport)
			reported = newReport
			connection.update(clientId, {
				state: { reported: { connections: newReport } },
			})
		}
	}, 10000)

	const reset = spawn('JLinkExe', [
		'-device',
		'nrf9160',
		'-if',
		'SWD',
		'-speed',
		'1000',
		'flash-at-thingy.script',
	])
	reset.stdout.on('data', (data) => {
		data.toString().trim().split('\n').filter(s => s.length).map(s => progress('Flash AT host', s))
	})

	reset.stderr.on('data', (data) => {
		data.toString().trim().split('\n').filter(s => s.length).map(s => warn('Flash AT host', s))
	})

	reset.on('exit', (code) => {
		if (code === 0) 
			success('Flash AT host', 'succeeded')
		else
			warn('Failed to reset DK')
	})
}

main()
