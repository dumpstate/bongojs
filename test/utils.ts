import assert from "node:assert/strict"
import { omit } from "lodash"

export function dropId(obj: any) {
	assert(obj.id !== undefined, "expected obj.id to be defined")
	assert(typeof obj.id === "string", "expected obj.id to be a string")
	assert(obj.id.length > 0, "expected obj.id to be a non-empty string")

	return omit(obj, ["id"])
}
