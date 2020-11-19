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

const notEmpty = (s?: any) => s !== undefined

export const log = (
	...prefixes: string[]
): {
	warn: (...args: any[]) => void
	progress: (...args: any[]) => void
	success: (...args: any[]) => void
	debug: (...args: any[]) => void
} => ({
	warn: (...args: any[]) => warn(...[...prefixes, ...args].filter(notEmpty)),
	progress: (...args: any[]) =>
		progress(...[...prefixes, ...args].filter(notEmpty)),
	success: (...args: any[]) =>
		success(...[...prefixes, ...args].filter(notEmpty)),
	debug: (...args: any[]) => debug(...[...prefixes, ...args].filter(notEmpty)),
})
