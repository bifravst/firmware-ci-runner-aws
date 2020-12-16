export const allSeen = (matches: string[]): ((s: string) => boolean) => {
	let n = 0
	const seen = matches.reduce(
		(seen, s) => ({ ...seen, [s]: -Number.MAX_SAFE_INTEGER }),
		{} as Record<string, number>,
	)
	return (line: string) => {
		n++
		matches.forEach((match) => {
			if (line.includes(match)) seen[match] = n
		})
		return (
			matches
				.map((match, k) => seen[match] > (seen[matches[k - 1]] ?? 0))
				.find((m) => m === false) === undefined
		)
	}
}
