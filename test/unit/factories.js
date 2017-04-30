export const minimalConfig = {
    client: () => true,
    defineDispatchEndpoint: () => null,
    defineRemoteActionsProducer: () => null,
    newId: () => Math.floor(Math.random() * 10000)
}
