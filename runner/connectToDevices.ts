import { connect, Connection } from './connect'
import { listDevices } from './listDevices'

export const connectToDevices = async (
	onIMEI: () => void,
): Promise<Record<string, Connection>> => {
	const connections = {} as Record<string, Connection>
	const c = connect(connections, onIMEI)
	const serialDevices = await listDevices()
	if (serialDevices.length === 0) {
		throw new Error(`No serial devices connected.`)
	}
	serialDevices.map((device) => {
		c(device)
	})
	return connections
}
