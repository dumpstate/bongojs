import { ID_LENGTH } from './constants'
import { DocType } from './model'


const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const ALPHABET_LENGTH = ALPHABET.length


let idGenerator: (len: number) => string


function doNotUseNextId(len: number) {
    let id = ''

    for (let i = 0; i < len; i++) {
        id += ALPHABET.charAt(
            Math.floor(Math.random() * ALPHABET_LENGTH)
        )
    }

    return id
}


function newIdGenerator() {
    try {
        return require('nanoid').nanoid
    } catch {
        return doNotUseNextId
    }
}


export function nextId<T>(doctype: DocType<T>): string {
    if (!idGenerator) {
        idGenerator = newIdGenerator()
    }

    if (doctype.prefix) {
        return `${doctype.prefix}_${idGenerator(ID_LENGTH - doctype.prefix.length - 1)}`
    }

    return idGenerator(ID_LENGTH)
}
