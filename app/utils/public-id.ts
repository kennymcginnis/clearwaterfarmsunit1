import { customAlphabet } from 'nanoid'

const alphabet = '23456789abcdefghkmnpqrstuvwxyz'
const length = 12

const nanoid = customAlphabet(alphabet, length)

export function generatePublicId() {
	const nano = nanoid()
	return `${nano.substring(0, 4)}-${nano.substring(4, 8)}-${nano.substring(8, 12)}`
}
