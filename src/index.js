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
  let message = {
    200 : "Ok",
    201 : "Created",
    204 : "Deleted",
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
      return Promise.resolve( _readFolder(pathname)  );
  }

  /* FOLDER DELETE
  */
  if( fstat && fstat.isDirectory() && options.method==="DELETE"){
      return Promise.resolve( response( await _unlinkFolder(pathname) ) );
  }

  /* FOLDER PUT (not supported per the spec)
  */
  if(options.method==="PUT"&& options.Link && options.Link.match("Container")){
       return Promise.resolve( response(405) );
  }

  if( options.method==="POST"){
      /*
         Fail POST if the Containing Folder doesn't exist
                or if no Slug is provided
         Set the pathname to be pathname join Slug
      */
      if( !fstat ) return Promise.resolve(response(404));
      if( !options.Slug ) return Promise.resolve(response(406));
      pathname = path.join(pathname,options.Slug);
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
          let fresults = _makeFolder(foldername,"recursive");
          if(!fresults===201) Promise.resolve( response(500) ); 
      }
      return new Promise((resolve) => {
          if (!options.body) { return resolve(
            response(406)
          )}
          let Readable = require('stream').Readable
          let s = new Readable
          s.push(options.body)
          s.push(null)  
          options.body = s;
          let status = 201;
          options.body.pipe(fs.createWriteStream(pathname)).on('finish',()=>{
              resolve( response(status,"Created",{'location': pathname}) )
          }).on('error', (err) => { 
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
