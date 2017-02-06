// LOL allow us to bend the rules about changing exports by wrapping the
// consts in mutable objects, which will be populated after initialization
export const Agents = {}
export const Epics = {}
export const NewId = []
export const Types = {}
export const ReducerForKey = []
export const ViewReducer = []
export const MetaEnhancers = [
  () => ({ actionId: Math.floor(Math.random() * 10000) })
]
export const DispatchProxy = []
