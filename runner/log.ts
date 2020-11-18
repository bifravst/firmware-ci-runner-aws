import * as chalk from 'chalk'

const stringify = (a: any) => (typeof a === 'object' ? JSON.stringify(a) : a)

export const warn = (...args: any[]): void =>
	console.warn(...args.map((arg) => chalk.yellow(stringify(arg))))
export const progress = (...args: any[]): void =>
	console.info(
		...args.map((arg) => chalk.blue(stringify(arg))),
		chalk.blue.dim('...'),
	)
export const success = (...args: any[]): void =>
	console.info(...args.map((arg) => chalk.green(stringify(arg))))
export const debug = (...args: any[]): void =>
	console.debug(...args.map((arg) => chalk.magenta(stringify(arg))))

export const log = (
	prefix: string,
): {
	warn: (...args: any[]) => void
	progress: (...args: any[]) => void
	success: (...args: any[]) => void
	debug: (...args: any[]) => void
} => ({
	warn: (...args: any[]) => warn(prefix, ...args),
	progress: (...args: any[]) => progress(prefix, ...args),
	success: (...args: any[]) => success(prefix, ...args),
	debug: (...args: any[]) => debug(prefix, ...args),
})
