import fetch from 'node-fetch'
import * as FormData from 'form-data'
import { parse } from 'url'
import * as querystring from 'querystring'

export const uploadToS3 = async (
	url: string,
	payload: Record<string, any>,
): Promise<void> => {
	const formData = new FormData()
	const u = parse(url)
	Object.entries(querystring.parse(u.query as string)).forEach(([k, v]) => {
		formData.append(k, v)
	})
	formData.append('file', JSON.stringify(payload, null, 2))
	const res = await fetch(`${u.protocol}//${u.host}${u.pathname}`, {
		method: 'POST',
		body: formData,
	})
	if (res.status >= 400) {
		throw new Error(
			`Failed to upload to S3: ${res.statusText} (${
				res.status
			}). ${await res.text()}`,
		)
	}
}
