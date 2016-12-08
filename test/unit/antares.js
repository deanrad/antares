import antares from '../../src/antares'

describe('antares', () => {
  describe('Greet function', () => {

    it('should return yo', () => {
      expect(antares()).to.equal('yo')
    })

  })
})
