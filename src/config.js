// LOL allow us to bend the rules about changing exports by wrapping the
// consts in mutable objects, which will be populated after initialization

// Agent config is overwritten in Meteor, but since we dont support non-Meteor servers
// if you need this defaulted, you're a client
export const Agents = {
  client: () => true
}
export const Epics = {}
export const NewId = []
export const Types = {}
export const ReducerForKey = []
export const ViewReducer = []
export const MetaEnhancers = [
  () => ({ actionId: Math.floor(Math.random() * 10000) })
]
export const DispatchProxy = []
