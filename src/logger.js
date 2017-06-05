export const logger = {
  log: (msg, opts = {}) => {
    const toPrint = opts.xform ? opts.xform(msg) : msg
    const prefix = (opts.prefix || '') + '> '
    if (opts.newSection) {
      console.log('  --------------  ')
    }
    console.log(prefix + toPrint)
  },
  debug: (...args) => logger.log(...args)
}

export const ppAction = action => {
  let key = action.meta.antares.key
  let metaLog = {
    ...action.meta,
    antares: {
      ...action.meta.antares,
      key: key && (key.join ? '[' + key.join(', ') + ']' : key)
    }
  }

  // Dispatching to the store may throw exception so log beforehand
  return `${action.type}
payload: ${JSON.stringify(action.payload, null, 2)}
meta: ${JSON.stringify(metaLog, null, 2)}`
}
