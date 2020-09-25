const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const { promises: fs } = require('fs')
const chalk = require('chalk')

const listDevices = async () => {
	const devs = await fs.readdir('/dev')
	return devs.filter((s) => s.startsWith('ttyACM')).map((s) => `/dev/${s}`)
}

const warn = (...args) =>
	console.warn(
		chalk.grey(`[${new Date().toISOString()}]`),
		...args.map((arg) => chalk.yellow(arg)),
	)
const progress = (...args) =>
	console.info(
		chalk.grey(`[${new Date().toISOString()}]`),
		...args.map((arg) => chalk.blue(arg)),
		chalk.blue.dim('...'),
	)
const success = (...args) =>
	console.info(
		chalk.grey(`[${new Date().toISOString()}]`),
		...args.map((arg) => chalk.green(arg)),
	)
const debug = (...args) =>
	console.debug(
		chalk.grey(`[${new Date().toISOString()}]`),
		...args.map((arg) => chalk.magenta(arg)),
	)

const connections = {}

const connect = (device) => {
	progress(`Connecting to`, device)
	const port = new SerialPort(device, { baudRate: 115200 })
	const parser = port.pipe(new Readline({ delimiter: '\n' }))

	const end = () => {
		progress(device, 'closing port')
		port.close()
		success(device, 'port closed')
		connections[device].connected = false
	}

	let isDk = false

	port.on('open', () => {
		success(device, `connected`)
		connections[device].connecting = false
		connections[device].connected = true
	})
	parser.on('data', (data) => {
		if (!isDk) debug(device, data)
		if (data.includes('DK Uptime is')) {
			if (!isDk) warn(device, 'is a DK: supressing future output')
			isDk = true
		}
		connections[device].lastSeen = Date.now()
	})
	port.on('close', (err) => {
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
			lastSeen: Date.now(),
		}
	})
	Object.entries(connections, (device, { lastSeen, end }) => {
		console.log({ lastSeen })
		const lastSeenSeconds = (Date.now() - lastSeen) / 1000
		if (lastSeenSeconds > 60) {
			warn(
				device,
				`has not sent data for more than ${lastSeenSeconds} seconds...`,
			)
		}
	})
}

const main = async () => {
	setInterval(connectToDevices, 10000)
	connectToDevices()
}

main()
