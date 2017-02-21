# antares

Turns a keyed object of Actions, Reducers, Epics, and Selectors into a full async API for changing data The Redux Way™

![ES 2015](https://img.shields.io/badge/ES-2015-brightgreen.svg)
[![Travis build status](https://api.travis-ci.org/deanius/antares.svg?branch=master)](https://travis-ci.org/deanius/antares)
[![Code Climate](https://codeclimate.com/github/deanius/antares/badges/gpa.svg)](https://codeclimate.com/github/deanius/antares)
[![Test Coverage](https://codeclimate.com/github/deanius/antares/badges/coverage.svg)](https://codeclimate.com/github/deanius/antares)
[![Dependency Status](https://david-dm.org/deanius/antares.svg)](https://david-dm.org/deanius/antares)
[![devDependency Status](https://david-dm.org/deanius/antares/dev-status.svg)](https://david-dm.org/deanius/antares#info=devDependencies)
![twitter link](https://img.shields.io/badge/twitter-@deaniusaur-55acee.svg)


# Installation
```
meteor add deanius:antares      #
```

[Antares Reference Documentation](https://deanius.gitbooks.io/the-antares-protocol/antares-reference.html)

# Example Applications

* [Smile Sender](https://github.com/deanius/antares-example-smile-sender) *Simplest Proof-Of-Concept*
* [SMS-style Chat App](https://github.com/deanius/antares-example-chat) *Optimistic UI, DB rendering*

# Help Wanted: Support Usage Outside of Meteor
While this package's core parts are published [on npm](https://www.npmjs.com/package/antares-protocol),
it currently uses Meteor's infrastructure for instantiating and communicating the web socket layer.

Follow: [Issue #1](https://github.com/deanius/antares/issues/1) and [Issue #2](https://github.com/deanius/antares/issues/2)
