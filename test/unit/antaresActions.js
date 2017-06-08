import {
  AntaresInit,
  getConfig,
  getUserConfig,
  Observable,
  fromJS,
  iList,
  ReductionError,
  TypeValidationError,
  ParentNotificationError
} from '../../src/antares'
import { minimalConfig } from '../helpers/factories'

const failIfNotRejected = fulfilledValue => {
  throw new Error('Didnt expect to fulfill with: ', fulfilledValue)
}

describe('Antares Actions', () => {
  let Antares
  let randomObject
  let randomSimpleKey
  let randomKeyArray

  before(() => {
    Antares = AntaresInit({
      ...minimalConfig,
      notifyParentAgent: action => Promise.resolve(action)
    })
  })
  beforeEach(() => {
    // could obviously be generated :)
    randomObject = { nested: { stuff: 'cool' } }
    randomSimpleKey = 'e875'
    randomKeyArray = ['documents', randomSimpleKey]
  })

  describe('Antares.init', () => {
    beforeEach(() => {
      Antares = AntaresInit({
        ...minimalConfig,
        notifyParentAgent: action => Promise.resolve(action)
      })
    })

    it('is used by a parent agent to identify itself to the child', function() {
      let announcementPromise = Antares.announce({
        type: 'Antares.init',
        meta: { antares: { parentAgentId: '8fed' } }
      })
      expect(Antares.parentAgentId).to.equal('8fed')
      return announcementPromise
    })

    it('should set the entire store to an immutable version of the payload', () => {
      let announcementPromise = Antares.announce({
        type: 'Antares.init',
        payload: { nested: { stuff: 'cool' } },
        meta: { antares: { parentAgentId: '8fed' } }
      })
      expect(Antares.getState().toJS()).to.deep.eql({
        nested: { stuff: 'cool' }
      })
      return announcementPromise
    })

    it('should set the entire store to an empty iMap if payload is falsy', () => {
      let announcementPromise = Antares.announce({
        type: 'Antares.init',
        meta: { antares: { parentAgentId: '8fed' } }
      })
      expect(Antares.getState().toJS()).to.deep.eql({})

      return announcementPromise
    })

    it('should not overwrite the store if recieved a second time', () => {
      let announcementPromise = Antares.announce({
        type: 'Antares.init',
        payload: { dont: 'lose me!' },
        meta: { antares: { parentAgentId: '8fed' } }
      })
      expect(Antares.getState().toJS()).to.deep.eql({ dont: 'lose me!' })

      announcementPromise = Antares.announce({
        type: 'Antares.init',
        payload: {},
        meta: { antares: { parentAgentId: '8fed' } }
      })
      expect(Antares.getState().toJS()).to.deep.eql({ dont: 'lose me!' })

      return announcementPromise
    })
  })

  describe('Antares.store', () => {
    describe('simple key', () => {
      it('should place the payload into the store at the given key', () => {
        let announcementPromise = Antares.announce({
          type: 'Antares.store',
          payload: randomObject,
          meta: { antares: { key: randomSimpleKey } }
        })

        expect(Antares.getState().get(randomSimpleKey).toJS()).to.deep.eql(
          randomObject
        )
        return announcementPromise
      })
    })
    describe('multi-part key array', () => {
      it('should place the payload into the store at the given key path', () => {
        let announcementPromise = Antares.announce({
          type: 'Antares.store',
          payload: randomObject,
          meta: { antares: { key: randomKeyArray } }
        })

        expect(Antares.getState().getIn(randomKeyArray).toJS()).to.deep.eql(
          randomObject
        )
        return announcementPromise
      })
    })
  })

  describe('Antares.fetch', () => {
    let Antares
    before(() => {
      Antares = AntaresInit({
        ...minimalConfig,
        onKeyNotDefined: key => {
          if (key[0] === 'forceError') {
            throw new Error()
          } else {
            return randomObject
          }
        }
      })
    })

    describe('without a value present at that key', () => {
      it('should populate the store with the synchronous return value of the onKeyNotDefined function', () => {
        expect(Antares.getState().get('notFound')).to.not.be.defined
        let announcementPromise = Antares.announce({
          type: 'Antares.fetch',
          meta: { antares: { key: 'notFound' } }
        })
        let storedValue = Antares.getState().get('notFound')
        expect(storedValue).to.be.ok
        expect(storedValue.toJS()).to.deep.eql(randomObject)
        return announcementPromise
      })

      it('should become a rejected promise if key lookup fails', () => {
        let announcementPromise = Antares.announce({
          type: 'Antares.fetch',
          meta: { antares: { key: ['forceError'] } }
        })

        return expect(announcementPromise).to.be.rejected
      })
    })
  })
})
