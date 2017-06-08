import {
  AntaresInit,
  getConfig,
  getUserConfig,
  Observable
} from '../../src/antares'
import { minimalConfig } from '../helpers/factories'

describe('AntaresInit', () => {
  it('should be a function', () => {
    expect(AntaresInit).to.be.instanceOf(Function)
  })

  describe('invocation of which', () => {
    let Antares
    let config
    const clientOneId = 'Client 1'

    before(() => {
      config = minimalConfig
      Antares = AntaresInit(config)
    })

    describe('returns Antares', () => {
      it('#agentId', () => {
        expect(Antares).to.have.property('agentId')
        expect(Antares.agentId).to.be.ok
      })

      it('#announce', () => {
        expect(Antares).to.have.property('announce')
        expect(Antares.announce).to.be.instanceOf(Function)
      })

      it('#subscribeRenderer', () => {
        expect(Antares).to.have.property('subscribeRenderer')
        expect(Antares.subscribeRenderer).to.be.instanceOf(Function)
      })

      it('#store', () => {
        expect(Antares).to.have.property('store')
        expect(Antares.store).to.be.instanceOf(Object)
      })

      // Meteor properties that should be in any instance
      xit('#startup', () => {
        expect(Antares).to.have.property('startup')
        expect(Antares.startup).to.be.ok
      })

      xit('#subscribe', () => {
        expect(Antares).to.have.property('subscribe')
        expect(Antares.subscribe).to.be.ok
      })

      xit('#remoteAction$', () => {
        expect(Antares).to.have.property('remoteAction$')
        expect(Antares.remoteAction$).to.be.instanceOf(Observable)
      })

      it('#getState', () => {
        expect(Antares).to.have.property('getState')
        expect(Antares.getState).to.be.instanceOf(Function)
      })

      // Properties relevant just to client mode
      it('#getViewState', () => {
        expect(Antares).to.have.property('getViewState')
        expect(Antares.getViewState).to.be.instanceOf(Function)
      })

      // Meteor properties we don't know how to test for in node yet
      xit('#remember', () => {
        expect(Antares).to.have.property('remember')
        expect(Antares.remember).to.be.instanceOf(Function)
      })

      // Meteor properties that dont need to exist post-initialization
      //  mongoRemembererFor mongoRendererFor, DDPToStoreRendererFor, ddpMessage$
      //

      // Properties slated for removal
      xit('#Config', () => {
        expect(Antares).to.not.have.property('Config')
      })

      xit('#asteroid', () => {
        expect(Antares).to.not.have.property('asteroid')
      })

      xit('#originate', () => {
        expect(Antares).to.not.have.property('originate')
      })
    })
  })
})
