import antares from '../../src/antares';

describe('antares', () => {
  describe('Greet function', () => {
    beforeEach(() => {
      spy(antares, 'greet');
      antares.greet();
    });

    it('should have been run once', () => {
      expect(antares.greet).to.have.been.calledOnce;
    });

    it('should have returned yo', () => {
      expect(antares.greet).to.have.returned('yo');
    });
  });
});
