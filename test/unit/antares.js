import { antares } from '../../src/antares'

describe('antares', () => {
  describe('Greet function', () => {
    let result = antares()

    it('should return yo', () => {
      expect(result).to.have.property('msg', 'yo')
    })

    it('should combine with rest-spread', () => {
      expect({id: 123, ...result}).to.deep.eql({ msg: 'yo', id: 123 })
    })

  })
})
