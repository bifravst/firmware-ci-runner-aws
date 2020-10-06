import { connect, Connection } from './connect'
import { listDevices } from './listDevices'

export const connectToDevices = async ({
	onIMEI,
}: {
	onIMEI: (connection: Connection) => void
}): Promise<[Record<string, Connection>, string[]]> => {
	const connections = {} as Record<string, Connection>
	const deviceLog: string[] = []
	const c = connect(connections, deviceLog, onIMEI)
	const serialDevices = await listDevices()
	if (serialDevices.length === 0) {
		throw new Error(`No serial devices connected.`)
	}
	serialDevices.map((device) => {
		c(device)
	})
	return [connections, deviceLog]
}
