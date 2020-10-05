import { promises as fs } from 'fs'

export const listDevices = async (): Promise<string[]> => {
	const devs = await fs.readdir('/dev')
	return devs
		.filter((s: string) => s.startsWith('ttyACM'))
		.map((s) => `/dev/${s}`)
}
