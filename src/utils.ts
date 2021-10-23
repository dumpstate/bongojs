import { nanoid } from 'nanoid'

import { ID_LENGTH } from './constants'
import { DocType } from './model'


export function nextId<T>(doctype: DocType<T>): string {
    if (doctype.prefix) {
        return `${doctype.prefix}_${nanoid(ID_LENGTH - doctype.prefix.length - 1)}`
    }

    return nanoid(ID_LENGTH)
}


export function omit(obj: any, keys: string[]) {
    let target: any = {}

    for (let key of Object.keys(obj)) {
        if (keys.indexOf(key) >= 0) {
            continue
        }

        target[key] = obj[key]
    }

    return target
}
