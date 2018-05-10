import { isInAgency } from "./agency"

const curLevel =
  typeof process.env.ANTARES_LOG_LEVEL === "undefined"
    ? 2
    : Number(process.env.ANTARES_LOG_LEVEL)

export const logger = {
  log: (
    msg,
    { xform = x => x, inAgency = "any", level = 2, newSection, prefix }
  ) => {
    const xmsg = xform(msg)
    const toPrint = typeof xmsg === "string" ? xmsg : JSON.stringify(xmsg)

    if (!isInAgency(inAgency)) return
    if (level > curLevel) return

    const prefixText = prefix ? prefix + "> " : ""
    if (newSection) {
      console.log("----------------  ")
    }
    console.log(prefixText + toPrint)
  },
  debug: (msg, opts) => logger.log(msg, { ...opts, level: 3 }),
  warn: (msg, opts) => logger.log(msg, { ...opts, level: 1 }),
  error: (msg, opts) => logger.log(msg, { ...opts, level: 0 })
}

export const ppAction = action => {
  let key = action.meta.antares.key
  let metaLog = {
    ...action.meta,
    antares: {
      ...action.meta.antares,
      key: key && (key.join ? "[" + key.join(", ") + "]" : key)
    }
  }

  // Dispatching to the store may throw exception so log beforehand
  return `${action.type}
payload: ${JSON.stringify(action.payload, null, 2)}
meta: ${JSON.stringify(metaLog, null, 2)}`
}
