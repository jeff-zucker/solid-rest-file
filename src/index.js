const concatStream = require('concat-stream')
const contentTypeLookup = require('mime-types').contentType
const fs = require('fs')
const path = require('path')
const url = require('url')
const Headers = require('node-fetch').Headers
const ReadableError = require('readable-error')
const Readable = require('stream').Readable

function text (stream) {
  return new Promise((resolve, reject) => {
    if(typeof stream === "string") return stream;
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
  let message = {
    200 : "Ok",
    201 : "Created",
    204 : "Deleted",
    400 : "Intermediate Container Not Found",
    404 : "Not Found",
    405 : "Method Not Supported",
    406 : "No Body",
    409 : "Conflict",
    500 : "Internal Server Error"
  }
  return {
    status: status,
    ok: status >= 200 && status <= 299,
    statusText: message[status],
    headers: new Headers(headers),
    body: body,
    text: text.bind(null, body),
    json: json.bind(null, body)
  }
}

async function fetch (iri, options) {
  options = options || {}
  options.method = (options.method || options.Method || 'GET').toUpperCase()
  options.contentTypeLookup = options.contentTypeLookup || contentTypeLookup
  let pathname = decodeURIComponent(url.parse(iri).pathname)
  const fstat = await _fileStat(pathname);

  /* FOLDER GET
  */
  if( fstat && fstat.isDirectory() && options.method==="GET"){
      return await  _readFolder(pathname) ;
  }

  /* FOLDER DELETE
  */
  if( fstat && fstat.isDirectory() && options.method==="DELETE"){
      return Promise.resolve( response( await _unlinkFolder(pathname) ) );
  }

  /* FOLDER PUT (not supported per the spec)
  */

  if( options.method==="POST"){
      /*
         Fail POST if the Containing Folder doesn't exist
                or if no Slug is provided
         Set the pathname to be pathname join Slug
      */
      if( !fstat ) return Promise.resolve(response(404));
      pathname = path.join(pathname,options.headers.Slug);

      /* 
         FOLDER POST
      */
      if( options.headers.Link && options.headers.Link.match("Container") ) {
          return Promise.resolve( response( await _makeFolder(pathname) ) );
      }
      /* 
          FILE POST (handled same as PUT)
      */
      else if(options.headers.Link && options.headers.Link.match("Resource")){
          options.method = "FILE-POST"
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
            {'Content-Type':options.contentTypeLookup(path.extname(pathname))}
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

  /* FILE PUT and FILE POST
  */
  else if (options.method === 'PUT' || options.method === "FILE-POST" ) {
      if(options.method==='PUT'){
          let filename = path.basename(pathname);
          let reg = new RegExp(filename+"\$")
          let foldername = pathname.replace(reg,'');
          let exists = await _fileStat(foldername);
          if(!exists){
              let fresults = await _makeFolder(foldername,"recursive");
              if(!fresults===201) Promise.resolve( response(500) ); 
          }
      }
      return new Promise((resolve) => {
          let s = new Readable
          s.push(options.body)
          s.push(null)  
          options.body = s;
          let status = 201;
          options.body.pipe(fs.createWriteStream(pathname)).on('finish',()=>{
              resolve( response(status,undefined,{'location': pathname}) )
          }).on('error', (err) => { 
               if(options.method==="PUT") resolve( response(405) )
               resolve( response(500) )
          })
      })
  }

  /* UNKNOWN METHOD
  */
  else {
      return Promise.resolve( response(405) )
  }
}

function makeStream(text){
      let s = new Readable
      s.push(text)
      s.push(null)  
      return s;
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
            else     resolve( 200 );
        });
    });
}
function _unlinkFolder(fn){
    return new Promise(function(resolve) {
        fs.rmdir( fn, function(err) {
            if(err) {
                resolve( 409 );
            } else {
                resolve( 200 );
            }
        });
    });
}
function _makeFolder(fn,recursive){
    fn = fn.replace(/\/$/,'');
    return new Promise(function(resolve) {
        let opts = (recursive) ? {"recursive":true} : {}
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
            str = makeStream(str+".");
            return ( resolve(response(
                200,
                str,
                {'Content-Type':'text/turtle'}
            )))
        });
    });
}

fetch.Headers = Headers

module.exports = fetch
