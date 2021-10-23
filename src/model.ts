export interface DocType<T> {
    readonly name: string
    readonly prefix?: string
    readonly schema: T
}
