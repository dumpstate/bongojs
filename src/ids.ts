import { ID_LENGTH } from "./constants"
import { DocType, SchemaTypeDef } from "./model"

const ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
const ALPHABET_LENGTH = ALPHABET.length

let idGenerator: () => string

function doNotUseNextId() {
	let id = ""

	for (let i = 0; i < ID_LENGTH; i++) {
		id += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET_LENGTH))
	}

	return id
}

function newIdGenerator() {
	try {
		return require("ulid").ulid
	} catch {
		return doNotUseNextId
	}
}

export function nextId<T extends SchemaTypeDef>(doctype: DocType<T>): string {
	if (!idGenerator) {
		idGenerator = newIdGenerator()
	}

	if (doctype.prefix) {
		return `${doctype.prefix}_${idGenerator()}`
	}

	return idGenerator()
}
