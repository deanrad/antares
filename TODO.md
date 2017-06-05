Agents

- Agency is an immutable object
- Host app provides functions to Antares to populate initial state

```
// configuration
Antares.configureAgency({
    trust: () => (Meteor.isServer ? 'kernel' : 'user')
})

// Agency resulting data object - Immutable
fromJS({
    trust: 'kernel'
})

// testing Agency - param object must be a subset of
if (Agency.has({ trust: 'kernel' }))

// helpers
Agency.helpers({
    isClient: (agency) => agency.get('trust') !== 'kernel'
})
// Agency.isClient()


// utilizing Agency config properties
messages.filter(msg => Agency.get('shardId') === msg.shardId
```

Actions

- should have payload types defined with schemas (and validator functions)
- should allow specifying agency levels

```
// a subscription for example should be processed entirely at the client
meta: { agentAffinity: { trust: 'user' } }
```

- subscribing is an Action (should be processed by a side-effecting reducer )

Selectors
- change when a route does
