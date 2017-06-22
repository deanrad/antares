import { inAgencyRun } from './agency'

export const logger = {
  log: (msg, opts = {}) => {
    const xmsg = opts.xform ? opts.xform(msg) : msg
    const toPrint = (typeof xmsg === 'string') ? xmsg : JSON.stringify(xmsg)
    const inAgency = opts.inAgency ? opts.inAgency : 'any'

    inAgencyRun(inAgency, () => {
      const prefix = opts.prefix ? (opts.prefix + '> ') : ''
      if (opts.newSection) {
        console.log('  --------------  ')
      }
      console.log(prefix + toPrint)
    })
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
