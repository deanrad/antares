// Configs that can be overridden by AntaresInit
export const Agents = {
    server: () => ((typeof process !== 'undefined') && process.env &&
        process.env.NODE_ENV && (process.env.NODE_ENV !== 'browser') &&
        !(typeof Meteor === 'object' && Meteor.isClient)),
    client: () => !Agents.server()
}
export const Epics = {}
export const NewId = []
export const ParentAgentId = []
export const Types = {}
export const ReducerForKey = []
export const ViewReducer = []
export const MetaEnhancers = [
    () => ({ actionId: Math.floor(Math.random() * 10000) })
]
export const DispatchProxy = []
