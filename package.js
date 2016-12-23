Package.describe({
    name: 'deanius:antares',
    version: '0.0.1',
    summary: 'Provides Antares Apps running in Meteor with things they need'
})

// antares must be a peer dependency for now
Npm.depends({})

Package.onUse(function(api) {
    api.versionsFrom('1.4.1.1')
    api.use('ecmascript')
    api.use('random')

    api.mainModule('meteor/AntaresMeteorInit.js')
})
