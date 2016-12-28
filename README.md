# antares

Turns a keyed object of Actions, Reducers, Epics, and Selectors into a full async API for changing data The Redux Way™

![ES 2015](https://img.shields.io/badge/ES-2015-brightgreen.svg)
[![Travis build status](http://img.shields.io/travis/deanius/antares.svg?style=flat)](https://travis-ci.org/deanius/antares)
[![Code Climate](https://codeclimate.com/github/deanius/antares/badges/gpa.svg)](https://codeclimate.com/github/deanius/antares)
[![Test Coverage](https://codeclimate.com/github/deanius/antares/badges/coverage.svg)](https://codeclimate.com/github/deanius/antares)
[![Dependency Status](https://david-dm.org/deanius/antares.svg)](https://david-dm.org/deanius/antares)
[![devDependency Status](https://david-dm.org/deanius/antares/dev-status.svg)](https://david-dm.org/deanius/antares#info=devDependencies)
![twitter link](https://img.shields.io/badge/twitter-@deaniusaur-55acee.svg)


# Installation
```
meteor add deanius:antares      #
```

# Usage (Meteor only)

```
import { AntaresMeteorInit, AntaresInit } from 'meteor/deanius:antares'

export const Antares = AntaresMeteorInit(AntaresInit)({
    Agencies,
    News,
    Types,
    ActionCreators,
    ReducerForAction,
    Epics,
    Selectors
})

Antares.dispatch(...)
```

# Developer Notes

This is a hybrid npm package and Meteor Atmosphere package.
