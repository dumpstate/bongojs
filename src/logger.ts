type LogFn = (msg: string, ...args: any[]) => void
type LoggingLevel = 'error' | 'warn' | 'info' | 'debug'


export interface LoggerConfig {
    readonly name: string
    readonly level?: LoggingLevel
}


export interface Logger {
    error: LogFn
    warn: LogFn
    info: LogFn
    debug: LogFn
}


export function newLogger(conf?: LoggerConfig): Logger {
    try {
        return require('pino')(conf)
    } catch {
        return console
    }
}
