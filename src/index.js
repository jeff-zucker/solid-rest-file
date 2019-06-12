const SolidRest             = require('solid-rest')
const SolidRestFile         = require('solid-rest/src/file.js')
const SolidRestLocalStorage = require('solid-rest/src/localStorage.js')
const fileHandler           = new SolidRest( new SolidRestFile() )
const appLsHandler          = new SolidRest( new SolidRestLocalStorage() )

async function filefetch(url,options){
  if ( url.startsWith("file:") ){
    return fileHandler.fetch(url,options)
  }
  else if ( url.startsWith("app://ls") ){
    return appLsHandler.fetch(url,options)
  }
  else throw `Unrecognized scheme in URL <${url}>`
}

module.exports = filefetch
