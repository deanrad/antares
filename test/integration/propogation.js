import {
  AntaresInit,
  getConfig,
  getUserConfig,
  Observable
} from '../../src/antares'
import Promise from 'bluebird'
import { minimalConfig } from '../helpers/factories'

let failIfResolved = () => expect(true).to.equal(false)

describe('Client Server Topology', () => {
  let server, clientSelf, clientOther

  /* XXX Theres a ton of setup in tests because too much functionality is trapped inside AntaresMeteorInit
    and must be replicated here instead of being reusable
   */
  before(() => {
    let serverStore

    /* Set up a server and 2 clients with it as their parent */
    server = AntaresInit({
      ...minimalConfig,
      agentId: 'TestServer'
    })
    serverStore = server.store

    // the dispatch proxy is what returns a promise for having communicated the action to the parent,
    // in this case calling the servers dispatcher directly
    const notifyParentAgent = action => {
      server.store.dispatch(action)
      return Promise.resolve(action)
    }

    // Skips pubsub. Consumes actions right off the server's action stream, not for this agent
    let testActionsConsumer = agentId => antaresDispatcher =>
      server.action$
        .map(({ action }) => action)
        .filter(
          action =>
            action.meta.antares.originAgentId !== agentId ||
            action.meta.antares.reflectAction
        )

    let clientConfig = {
      ...minimalConfig,
      connectionUrl: 'test://server',
      notifyParentAgent,
      Agents: { client: () => true }
    }

    clientSelf = AntaresInit({
      ...clientConfig,
      defineRemoteActionsConsumer: testActionsConsumer('TestCSelf'),
      agentId: 'TestCSelf'
    })

    clientOther = AntaresInit({
      ...clientConfig,
      defineRemoteActionsConsumer: testActionsConsumer('TestCOther'),
      agentId: 'TestCOther'
    })
  })

  describe('With no subscription limits', () => {
    before(() => {
      // because we're directly plugged in to the server in tests, no need to subscribe
      // server.subscribe('*')
      // clientSelf.subscribe('*')
      // clientOther.subscribe('*')
    })

    describe('A client-announced action without localOnly:true', () => {
      it('Will propogate through originator, server, and other client', function() {
        let testAction = {
          type: 'Test.action',
          meta: { antares: { actionId: 'e230' } }
        }

        // Assert that the originating agent sees actions in its store synchronously
        let clientSelfActions = []
        let clientSelfSub = clientSelf.action$.subscribe(({ action }) => {
          clientSelfActions.push(action)
        })

        // Assert that other agents eventually see it
        let firstServerAction = server.action$
          .first()
          .map(({ action }) => action)
          .toPromise(Promise)
          .timeout(100, 'Took too long for firstServerAction')

        let firstOtherAction = clientOther.action$
          .first()
          .map(({ action }) => action)
          .toPromise(Promise)
          .timeout(100, 'Took too long for firstOtherAction')

        // We expect only to be able to assert after the originating agent's promise resolves
        // and once the server has it, we wait to assert on the Other client until they have something
        return clientSelf
          .announce(testAction)
          .then(() => expect(clientSelfActions[0]).to.containSubset(testAction))
          .then(() => firstServerAction)
          .then(serverAction => {
            expect(serverAction).to.containSubset(testAction)
          })
          .then(() => firstOtherAction)
          .then(otherAction => {
            expect(otherAction).to.containSubset(testAction)
          })
          .then(() => {
            expect(
              clientSelfActions,
              JSON.stringify(clientSelfActions)
            ).to.have.property('length', 1)
          })
      })

      it('Will come back to the sender if reflectAction:true', () => {
        let testAction = {
          type: 'Test.action',
          meta: { antares: { actionId: 'e231', reflectAction: true } }
        }

        // Assert that the originating agent sees actions in its store synchronously
        let clientSelfActions = []
        let clientSelfSub = clientSelf.action$.subscribe(({ action }) => {
          clientSelfActions.push(action)
        })

        return clientSelf
          .announce(testAction)
          .then(() =>
            expect(
              clientSelfActions,
              JSON.stringify(clientSelfActions)
            ).to.have.length(2)
          )
      })
    })

    describe('A server-announced action without localOnly:true', () => {
      it('Will propogate through server, and all clients', function() {
        let testAction = {
          type: 'Test.action',
          meta: { antares: { actionId: 'ff89' } }
        }

        // Assert that the originating agent sees actions in its store synchronously
        let serverActions = []
        let serverSub = server.action$.subscribe(({ action }) => {
          serverActions.push(action)
          serverSub.unsubscribe()
        })

        // Assert that other agents eventually see it
        let firstClientSelfAction = clientSelf.action$
          .first()
          .map(({ action }) => action)
          .toPromise()

        let firstClientOtherAction = clientOther.action$
          .first()
          .map(({ action }) => action)
          .toPromise()

        // We expect only to be able to assert after the originating agent's promise resolves
        // and once the server has it, we wait to assert on the Other client until they have something
        return server
          .announce(testAction)
          .then(() => expect(serverActions[0]).to.containSubset(testAction))
          .then(() => firstClientSelfAction)
          .then(clientAction => {
            expect(clientAction).to.containSubset(testAction)
          })
          .then(() => firstClientOtherAction)
          .then(clientAction => {
            expect(clientAction).to.containSubset(testAction)
          })
      })
    })

    describe('An announced action with localOnly:true', () => {
      it('Will be seen only on its originator', function() {
        let testAction = {
          type: 'Test.action',
          meta: { antares: { actionId: 'a919', localOnly: true } }
        }

        // Assert that the originating agent sees actions in its store synchronously
        let serverActions = []
        let serverSub = server.action$.subscribe(({ action }) => {
          serverActions.push(action)
          serverSub.unsubscribe()
        })

        // Can't assert NEVER, but this wait is sufficient
        let clientSelfDoesntGetAction = clientSelf.action$
          .first()
          .map(({ action }) => action)
          .toPromise(Promise)
          .timeout(40)
          .then(failIfResolved, () => {
            /* else ok */
          })

        // We expect only to be able to assert after the originating agent's promise resolves
        // and once the server has it, we wait to assert on the Other client until they have something
        return server
          .announce(testAction)
          .then(() => expect(serverActions[0]).to.containSubset(testAction))
          .then(() => clientSelfDoesntGetAction)
      })
    })
  })
})
