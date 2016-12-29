// LOL allow us to bend the rules about changing exports by wrapping the
// consts in mutable objects, which will be populated after initialization
export const Agents = {}
export const Epics = {}
export const ReducerForKey = []
export const MetaEnhancers = [
  () => ({ actionId: Math.floor(Math.random() * 1000) })
]
export const DispatchProxy = []
