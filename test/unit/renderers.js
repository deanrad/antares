import Promise from "bluebird"
import { expect } from "chai"

import { AntaresInit, RenderError } from "../../src/antares"
import { minimalConfig } from "../helpers/factories"

const failIfNotRejected = fulfilledValue => {
  throw new Error("Didnt expect to fulfill with: " + fulfilledValue)
}

describe("Renderers", () => {
  let Antares
  let callCount
  let rendererSub
  let testAction = {
    type: "groovy"
  }

  const testRenderer = ({ action }) => {
    if (action.payload && action.payload.bomb) {
      throw new Error("Oops, i asploded!")
    }
    callCount = callCount + 1
    return callCount
  }

  beforeEach(() => {
    Antares = AntaresInit({
      ...minimalConfig
    })

    // renderer[0], aliased to callCount in the action stream
    rendererSub = Antares.subscribeRenderer(testRenderer, {
      actionStreamKey: "callCount"
    })
    // renderer[1], under the key 'renderer[1]' in the stream
    Antares.subscribeRenderer(function noKeyNoopRenderer() {
      return Math.PI
    })
    callCount = 0
  })

  describe("#subscribeRenderer (all modes)", () => {
    describe("without a filter", () => {
      it("run the passed function for each event in the action stream", () => {
        Antares.process(testAction)
        expect(callCount).to.equal(1)
      })
    })

    describe("with a filter", () => {
      it("runs the function for each event matching the filter", () => {
        let callCount = 0
        Antares.subscribeRenderer(
          () => {
            callCount += 1
          },
          {
            filter: ({
              action: {
                payload: { value }
              }
            }) => value && value % 2 === 0
          }
        )
        Antares.process({ type: "onlyOdd", payload: { value: 2 } })
        expect(callCount).to.equal(1)
        Antares.process({ type: "onlyOdd", payload: { value: 3 } })
        expect(callCount).to.equal(1)
      })
    })

    it("returns a handle with which to unsubscribe", () => {
      Antares.process(testAction)
      expect(callCount).to.equal(1)

      rendererSub.unsubscribe()

      Antares.process(testAction)
      expect(callCount).to.equal(1)
    })

    it("places results into a field of the actionStreamKey", () => {
      let capturedRetVal = Antares.action$
        .first()
        .toPromise()
        .then(streamItem => {
          expect(streamItem).to.have.property("callCount", 1)
        })

      Antares.process(testAction)
      return capturedRetVal
    })

    it("if actionStreamKey is not specified, result is under renderer[N]", () => {
      let capturedRetVal = Antares.action$
        .first()
        .toPromise()
        .then(streamItem => {
          expect(streamItem).to.have.property("renderer[1]", Math.PI)
        })

      Antares.process(testAction)
      return capturedRetVal
    })
  })

  describe("#subscribeRenderer (default, sync mode)", () => {
    it("causes renderer exceptions to become rejected promises", () => {
      let processedPromise = Antares.process({
        type: "Test",
        payload: { bomb: "BOOM!" }
      })
        .then(failIfNotRejected)
        // A bluebird feature: http://bluebirdjs.com/docs/api/catch.html
        .catch(RenderError, ex => "ok")

      return expect(processedPromise).to.be.fulfilled
    })

    it("will continue processing actions after an error", () => {
      return Antares.process(testAction)
        .then(() => expect(callCount).to.equal(1))
        .then(() => Antares.process(testAction))
        .then(() => expect(callCount).to.equal(2))
        .then(() =>
          Antares.process({
            type: "Test",
            payload: { bomb: "BOOM!" }
          }).catch(RenderError, () => true)
        )
        .then(() => expect(callCount).to.equal(2))
        .then(() => Antares.process(testAction))
        .then(() => expect(callCount).to.equal(3))
    })

    it("will await the output if a promise is returned from the renderer", function() {
      let remoteJson = "{remoteJSON: true}"
      let remoteResult

      Antares.subscribeRenderer(
        () =>
          Promise.resolve(remoteJson)
            .delay(10)
            .tap(remoteJson => {
              remoteResult = remoteJson
            }),
        {
          filter: ({ action: { type } }) => type === "delayedAction",
          actionStreamKey: "remoteJson"
        }
      )

      Antares.process({ type: "delayedAction" })

      this.skip()
      // it awaited
      expect(remoteResult).to.equal(remoteJson)
    })

    it("handles a renderer returning an Observable by ...(TODO)")
  })

  describe("#subscribeRenderer (async mode)", () => {
    it("can take an xform argument to batch or time-alter the stream")
    it("handles a single value")
    it("handles a promised value")
    it("handles an observable that does not error")
    it("handles an observable that errors")
    it("handles an exception")
  })
})
