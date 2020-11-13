import * as path from 'path'
import { realpathSync } from 'fs'

export const atHostHexFile = {
	thingy91: path.join(
		path.dirname(realpathSync(__filename)),
		'..',
		'..',
		'at_client',
		'thingy91_at_client_increased_buf.hex',
	),
	'9160dk': path.join(
		path.dirname(realpathSync(__filename)),
		'..',
		'..',
		'at_client',
		'91dk_at_client_increased_buf.hex',
	),
} as const
