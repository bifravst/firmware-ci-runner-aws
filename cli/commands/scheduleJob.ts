import { CommandDefinition } from './CommandDefinition'
import { IoTClient } from '@aws-sdk/client-iot'
import { S3Client } from '@aws-sdk/client-s3'
import { schedule } from '../../job/schedule'

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
		await schedule({
			bucketName,
			region,
			ciDeviceArn,
			iot: new IoTClient({
				region,
			}),
			s3: new S3Client({
				region,
			}),
			certificateJSON,
			firmwareUrl,
			network: network ?? defaultNetwork,
			secTag: secTag === undefined ? defaultSecTag : parseInt(secTag, 10),
			target: target ?? defaultTarget,
		})
	},
	help: 'Schedules a new Firmware CI job.',
})
