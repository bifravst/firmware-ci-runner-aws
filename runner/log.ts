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
