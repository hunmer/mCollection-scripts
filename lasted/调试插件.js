// ==UserScript==
// @name        调试插件
// @namespace   22cd3092-ac9c-4369-9798-c522e42c0be9
// @version     0.0.1
// @author      作者名称
// @description 注释说明
// @updateURL               
// @primary     1
// ==/UserScript==

(() => {
    const winston = nodejs.require(g_plugin.getSciptPath() + 'node_modules/winston');
    class Logger {
        constructor() {
            // Retain a reference to the original console
            this.originalConsole = window.console;
            this.timers = new Map([]);

            // Configure a logger
            this.logger = winston.createLogger({
                level: 'info',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.printf(({ level, message, timestamp }) => {
                        return `${timestamp} ${level}: ${message}`;
                    })
                ),
                transports: [
                    new winston.transports.File(
                        {
                            filename: `${nodejs.dir}/logs/${Date.now()}.log`, // Note: require('electron').remote is undefined when I include it in the normal imports
                            handleExceptions: true, // Log unhandled exceptions
                            maxsize: 1048576, // 10 MB
                            maxFiles: 10
                        }
                    )
                ]
            });

            const _this = this;

            // Switch out the console with a proxied version
            window.console = new Proxy(this.originalConsole, {
                // Override the console functions
                get(target, property) {
                    // Leverage the identical logger functions
                    if (['debug', 'info', 'warn', 'error'].includes(property)) return (...parameters) => {
                        _this.logger[property](parameters);
                        // Simple approach to logging to console. Initially considered
                        // using a custom logger. But this is much easier to implement.
                        // Downside is that the format differs but I can live with that
                        _this.originalConsole[property](...parameters);
                    }
                    // The log function differs in logger so map it to info
                    if ('log' === property) return (...parameters) => {
                        _this.logger.info(parameters);
                        _this.originalConsole.info(...parameters);
                    }
                    // Re-implement the time and timeEnd functions
                    if ('time' === property) return (label) => _this.timers.set(label, window.performance.now());
                    if ('timeEnd' === property) return (label) => {
                        const now = window.performance.now();
                        if (!_this.timers.has(label)) {
                            _this.logger.warn(`console.timeEnd('${label}') called without preceding console.time('${label}')! Or console.timeEnd('${label}') has been called more than once.`)
                        }
                        _this.timers.delete(label);
                        const message = `${label} ${getFormatedTime()}`;
                        _this.logger.info(message);
                        _this.originalConsole.info(message);
                    }

                    // Any non-overriden functions are passed to console
                    return target[property];
                }
            });
            process.on('uncaughtException', function (err) {
                _this.logger.info(err.stack);
            });
            window.onerror = function(message, source, lineno, colno, err) {
                _this.logger.info(err.stack || err);
            }
        }
    }

    new Logger();
})()