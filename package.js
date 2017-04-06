Package.describe({
    name: 'deanius:antares',
    version: '0.3.17',
    summary: 'Antares defines a protocol and API for distributed awareness among streaming agents.'
})

Package.onUse(function(api) {
    api.versionsFrom('1.4.1.1')
    api.use('ecmascript')
    api.use('random')

    api.mainModule('meteor/AntaresMeteorInit.js', ['client', 'server'])
})
