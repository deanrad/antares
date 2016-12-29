// after initialization, these 'constant' references will be populated
export const Agents = {}
export const Epics = {}
export const ReducerForKey = []
export const MetaEnhancers = [
  () => ({ actionId: Math.floor(Math.random() * 1000) })
]

