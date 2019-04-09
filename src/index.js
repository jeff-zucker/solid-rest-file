const concatStream = require('concat-stream')
const contentTypeLookup = require('mime-types').contentType
const fs = require('fs')
const path = require('path')
const url = require('url')
const Headers = require('node-fetch').Headers
const ReadableError = require('readable-error')

function text (stream) {
  return new Promise((resolve, reject) => {
    stream = stream || "";
    if(typeof stream === "string") {
        resolve(stream);
    }
    stream.pipe(concatStream({
      encoding: 'string'
    }, resolve))
    stream.on('error', reject)
  })
}

function json (stream) {
  return text(stream).then(text => JSON.parse(text))
}

function response (status, body, headers) {
  return {
    status: status,
    ok: status >= 200 && status <= 299,
    headers: new Headers(headers),
    body: body,
    text: text.bind(null, body),
   json: json.bind(null, body)
  }
}

async function fetch (iri, options) {
  options = options || {}
  options.method = (options.method || 'GET').toUpperCase()
  options.contentTypeLookup = options.contentTypeLookup || contentTypeLookup
  const pathname = decodeURIComponent(url.parse(iri).pathname)
  const fstat = await _fileStat(pathname);

  /* FOLDER GET
  */
  if( fstat && fstat.isDirectory() && options.method==="GET"){
      return Promise.resolve( _readFolder(pathname)  );
  }

  /* FOLDER DELETE
  */
  if( fstat && fstat.isDirectory() && options.method==="DELETE"){
      return Promise.resolve( response( await _unlinkFolder(pathname) ) );
  }

  if( options.method==="POST"){
      /* 
         FOLDER POST
      */

      if( options.Link && options.Link.match("Container") ) {
          return Promise.resolve( response( await _makeFolder(pathname) ) );
      }
      /* 
          FILE POST (handled same as PUT)
      */
      else if( options.Link && options.Link.match("Resource") ) {
          options.method = "PUT"
      }
  }

  /* FILE GET 
  */
  if (options.method === 'GET') {
      if( !fstat ) {
          return Promise.resolve(response(404))
      }
      else {
          let success;
          try{ success = await fs.createReadStream(pathname); }
          catch(e){}
          if(!success) return Promise.resolve(response(500)) 
          return Promise.resolve( response(
            200,
            success,
            {'content-type':options.contentTypeLookup(path.extname(pathname))}
          ))
      }
  }

  /* FILE DELETE
  */
  else if (options.method === 'DELETE' ) {
      if( !fstat ) {
          return Promise.resolve(response(404))
      }
      else {
          return new Promise((resolve) => {
              _unlinkFile(pathname).then( statusCode => { 
                  return resolve( response(statusCode) )
              })
          });
      }
  }

  /* FILE PUT
  */
  else if (options.method === 'PUT') {
      return new Promise((resolve) => {
          if (!options.body) { return resolve(
            response(406, new ReadableError(new Error('body required')))
          )}
          let Readable = require('stream').Readable
          let s = new Readable
          s.push(options.body)
          s.push(null)  
          options.body = s;
          options.body.pipe(fs.createWriteStream(pathname)).on('finish',()=>{
              resolve( response(201,"Created",{'location': pathname}) )
          }).on('error', (err) => { 
               resolve( response(500, new ReadableError(err)) )
          })
      })

  }

  /* UNKNOWN METHOD
  */
  else {
      return Promise.resolve(
          response(405, new ReadableError(new Error('method not allowed')))
      )
  }
}

async function _fileStat(fn){
    let stat;
    try { stat = await fs.lstatSync(fn); return stat; }
    catch(err){ return false; }
}
function _unlinkFile(fn){
    return new Promise(function(resolve) {
        fs.unlink( fn, function(err) {
            if(err)  resolve( 409 );
            else     resolve( 204 );
        });
    });
}
function _unlinkFolder(fn){
    return new Promise(function(resolve) {
        fs.rmdir( fn, function(err) {
            if(err) {
                resolve( 409 );
            } else {
                resolve( 204 );
            }
        });
    });
}
function _makeFolder(fn,recursive){
    return new Promise(function(resolve) {
        let opts = (recursive) ? {recursive:true} : {}
        fs.mkdir( fn, opts, (err) => {
            if(err) {
                resolve( 409 )
            } 
            else {
                resolve( 201 );
            }
        });
    });
}
function _readFolder(pathname){
    return new Promise(function(resolve) {
        fs.readdir(pathname, function(err, filenames) {
            if (err) {
                return resolve( 409 );
            }
            let str = `@prefix ldp: <http://www.w3.org/ns/ldp#>.

<>
    a ldp:BasicContainer, ldp:Container
` // eos
            if(filenames.length){
                str = str + "; ldp:contains\n";
                filenames.forEach(function(filename) {
                    str = str + `<${path.join(pathname,filename)}>,`
                });
                str = str.replace(/,$/,"");
            }
            str = str+".";
            return resolve( response(
                200,
                str,
                {'content-type':'text/turtle'}
            ))
        });
    });
}

fetch.Headers = Headers

module.exports = fetch
