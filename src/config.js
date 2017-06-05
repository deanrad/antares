// Configs that can be overridden by AntaresInit
export const Agents = {
  server: () =>
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NODE_ENV &&
    process.env.NODE_ENV !== 'browser' &&
    !(typeof Meteor === 'object' && Meteor.isClient),
  client: () => !Agents.server()
}
export const Epics = {}
export const NewId = [() => Math.floor(Math.random() * 100000)]
export const ParentAgentId = []
export const Types = {}
export const ReducerForKey = []
export const ViewReducer = []
export const MetaEnhancers = [
  // like airplane flight numbers, only guaranteed unique within small time window
  iAction =>
    (iAction.getIn(['meta', 'antares', 'actionId'])
      ? {}
      : { actionId: Math.floor(Math.random() * 10000) }),
  (_, Antares) => ({ originAgentId: Antares.agentId })
]
export const DispatchProxy = []
