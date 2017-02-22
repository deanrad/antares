### [0.0.1](https://github.com/deanius/antares/releases/tag/v0.0.1)

### [0.2.3](https://github.com/deanius/antares/releases/tag/v0.2.3)
* Antares.dispatch became `Antares.announce`
* The DDP name of dispatch became `Antares.acknowledge`
* Antares.subscribe MUST be called to see remoteActions (see all with '*')


### [0.2.5](https://github.com/deanius/antares/releases/tag/v0.2.5)
* Expose Immutable from Antares

### [0.2.7](https://github.com/deanius/antares/releases/tag/v0.2.7)
### [0.3.0](https://github.com/deanius/antares/releases/tag/v0.3.0)
* Underlay parent metadata in return from createConsequence
* Better logging for store.dispatch errors
* Antares.firstSubscriber promise inAgency: server
* Expose localConsequence factory for the common case of agent-local consequences
* Include the .action field on the return value of 'announce' with enhancedAction object
* Added .startOfEpic() on the return value of 'announce'
* Moved .endOfEpic() getter to the return value of 'announce'
* Antares.originate - creates meta-enhanced action synchronously, same interface as announce
* Honors the Types config option now - if an action.type has a corresponding validator function, it will be used
* If subscribe called with a key, client receives current state of that key upon connect (DDP added)
* Added Antares.startup

### [0.3.12] (https://github.com/deanius/antares/releases/tag/v0.3.12)
* Type errors blow the stack- check proactively if you want better UX
