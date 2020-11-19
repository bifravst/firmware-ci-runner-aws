export const defaultTimeoutInMinutes = 2

export type FirmwareCIJobDocument = {
	timeoutInMinutes?: number
	reportPublishUrl: string
	reportUrl: string
	fw: string
	target: string
	expires: string
	credentials?: {
		secTag: number
		privateKey: string
		clientCert: string
		caCert: string
	}
	abortOn?: string[]
	endOn?: string[]
}

export type RunningFirmwareCIJobDocument = {
	id: string
	timeoutInMinutes: number
} & FirmwareCIJobDocument
