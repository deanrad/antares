![antares](http://www.deanius.com/AntaresLogo.png)

Antares defines a protocol and API for distributed awareness among streaming agents.

![ES 2015](https://img.shields.io/badge/ES-2015-brightgreen.svg)
 [![npm version](https://badge.fury.io/js/antares-protocol.svg)](https://badge.fury.io/js/antares-protocol)
[![Travis build status](https://api.travis-ci.org/deanius/antares.svg?branch=master)](https://travis-ci.org/deanius/antares) 
<!--
[![Code Climate](https://codeclimate.com/github/deanius/antares/badges/gpa.svg)](https://codeclimate.com/github/deanius/antares)
[![Test Coverage](https://codeclimate.com/github/deanius/antares/badges/coverage.svg)](https://codeclimate.com/github/deanius/antares)
-->[![Dependency Status](https://david-dm.org/deanius/antares.svg)](https://david-dm.org/deanius/antares)
[![devDependency Status](https://david-dm.org/deanius/antares/dev-status.svg)](https://david-dm.org/deanius/antares#info=devDependencies)
![twitter link](https://img.shields.io/badge/twitter-@deaniusaur-55acee.svg)


# Installation - Node, Browser

Antares' client functionality can be used in any JavaScript app, including
those of the Create React App variety ([example](https://github.com/deanius/antares-example-static-smile-sender)) which can be hosted on static sites such as [S3](http://www.deanius.com/antares-example-static-smile-sender/) or [surge.sh](https://surge.sh/).

```
npm add -S antares-protocol

// some-file.js
import { AntaresInit } from 'antares-protocol'

let Antares = AntaresInit({
    connectionUrl: 'ws://server:port/path
})
```

# Installation - Meteor
Currently the server part can only be hosted by Meteor, as it takes advantage
of Meteor's pubsub system (see [Issue #2](https://github.com/deanius/antares/issues/2)).
In Meteor, the Antares client automatically connects back to the server it was served from.

```
> meteor add deanius:antares

// /imports/antares/index.js
import { AntaresInit } from 'meteor/deanius:antares'
export const Antares = AntaresMeteorInit(AntaresInit)(AntaresConfig)

```

[Antares Reference Documentation](https://deanius.gitbooks.io/the-antares-protocol/antares-reference.html)

# Example Applications

* [Smile Sender](https://github.com/deanius/antares-example-static-smile-sender) *Simplest Proof-Of-Concept*
* [SMS-style Chat App](https://github.com/deanius/antares-example-chat) *Optimistic UI, DB rendering*
* [Board Game (Chess)](https://github.com/deanius/antares-example-chess) *Advanced Epic Functionality*

# Help Wanted!
Sample applications, test coverage, documentation, and allowing the server portion to run outside of Meteor. If you're interested, open an Issue and begin the conversation!

