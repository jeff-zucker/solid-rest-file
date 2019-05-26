/* 
  Incorporates parts of Thomas Bergwinki's file-fetch
*/
const concatStream = require('concat-stream')
const Headers = require('node-fetch').Headers
const contentTypeLookup = require('mime-types').contentType
const url = require('url')
const Readable = require('stream').Readable
const path = require("path");
const fs = require("fs");
/* 
  RESPONSE HANDLERS
*/
const statusText = {
    200 : "Ok",
    201 : "Created",
    404 : "Not Found",
    405 : "Method Not Supported",
    409 : "Conflict",
    500 : "Internal Server Error"
}
function response (status, body, headers) {
  return {
    status: status,
    ok: status >= 200 && status <= 299,
    statusText: statusText[status],
    headers: new Headers(headers),
    body: body,
    text: text.bind(null, body),
    json: json.bind(null, body)
  }
}

/*
  REQUEST HANDLER
*/
async function fetch (iri, options) {
  options = options || {}
  options.method = (options.method || options.Method || 'GET').toUpperCase()
  options.contentTypeLookup = options.contentTypeLookup || contentTypeLookup
  let pathname = decodeURIComponent(url.parse(iri).pathname)
  const objectType = await _getObjectType(pathname);

  if( options.method==="GET" && objectType==="Container"){
      return await  _getContainer(pathname) ;
  }
  if( options.method==="DELETE" && objectType==="Container" ){
      return Promise.resolve( response( await _deleteContainer(pathname) ) );
  }
  if( options.method==="POST"){
      let slug = options.headers.Slug || options.headers.slug
      let link = options.headers.Link || options.headers.link
      if( objectType==="notFound" ) return Promise.resolve(response(404));
      pathname = path.join(pathname,slug);
      if( link && link.match("Container") ) {
          return Promise.resolve( response( await postContainer(pathname) ) );
      }
      else if( link && link.match("Resource")){
          options.method = "POST-RESOURCE"
      }
  }
  if (options.method === 'GET') {
      if( objectType==="notFound" ) {
          return Promise.resolve(response(404))
      }
      else {
          return await _getResource(pathname,options);
      }
  }
  else if (options.method === 'DELETE' ) {
      if( objectType==="notFound" ) {
          return Promise.resolve(response(404))
      }
      else {
          return new Promise((resolve) => {
              _deleteResource(pathname).then( statusCode => { 
                  return resolve( response(statusCode) )
              })
          });
      }
  }
  else if (options.method === 'PUT' || options.method === "POST-RESOURCE" ) {
      if(options.method==='PUT'){
          await _makeContainers(pathname); /* MAKE CONTAINERS */
      }
      return await _putResource( pathname, options ); /* PUT RESOURCE */
  }
  else {
      return Promise.resolve( response(405) )   /* UNKNOWN METHOD */
  }
}

/*
  STREAM HANDLERS
*/
function _makeStream(text){
      let s = new Readable
      s.push(text)
      s.push(null)  
      return s;
}
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

/*
  RESOURCE HANDLERS
*/
function _getObjectType(fn){
    let stat;
    try { stat = fs.lstatSync(fn); }
    catch(err){ return "notFound"; }
    return ( stat.isDirectory()) ? "Container" : "Resource";
}
async function _getResource(pathname,options){
    let success;
    try{ success = await fs.createReadStream(pathname); }
    catch(e){}
    if(!success) return Promise.resolve(response(500)) 
    return Promise.resolve( response(
        200,
        success, {
          'Content-Type':options.contentTypeLookup(path.extname(pathname)),
          Link : '<.meta>; rel="describedBy", <.acl>; rel="acl"'
        }
    ))
}
function _putResource(pathname,options){
    return new Promise((resolve) => {
        options.body = _makeStream( options.body );
        options.body.pipe(fs.createWriteStream(pathname)).on('finish',()=>{
            resolve( response(201,undefined,{'location': pathname}) )
        }).on('error', (err) => { 
             if(options.method==="PUT") resolve( response(405) )
             resolve( response(500) )
        })
    })
}
function _deleteResource(fn){
    return new Promise(function(resolve) {
        fs.unlink( fn, function(err) {
            if(err)  resolve( 409 );
            else     resolve( 200 );
        });
    });
}

/* 
  CONTAINER HANDLERS
*/
function _deleteContainer(fn){
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
function postContainer(fn,recursive){
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
async function _makeContainers(pathname){
      let filename = path.basename(pathname);
      let reg = new RegExp(filename+"\$")
      let foldername = pathname.replace(reg,'');
      let exists = await _getObjectType(foldername);
      if(exists==="notFound"){
          let fresults = await postContainer(foldername,"recursive");
          if(!fresults===201) Promise.resolve( response(500) ); 
       }
}
async function _getContainer(pathname){
    return new Promise(function(resolve) {
       fs.readdir(pathname, function(err, filenames) {
            let str2 = "";
            let str = `@prefix ldp: <http://www.w3.org/ns/ldp#>.
<> a ldp:BasicContainer, ldp:Container` // eos
            if(filenames.length){
                str = str + "; ldp:contains\n";
                filenames.forEach(function(filename) {
                    let fn = path.join(pathname,filename)
                    if(!fn.endsWith('.acl') && !fn.endsWith('.meta')){
                      let ftype = _getObjectType(fn);
                      ftype = (ftype==="Container") ? "BasicContainer; a ldp:Container": ftype
                      str = str + `<${fn}>,\n`
                      str2=str2+`<${fn}> a ldp:${ftype}.\n`
                   }
                });
                str = str.replace(/,\n$/,"")
            }
            str = str+`.\n`+str2;
            str = _makeStream(str);
            return ( resolve(response(
                200,
                str, {
                    'Content-Type':'text/turtle',
                    Link : '<.meta>; rel="describedBy", <.acl>; rel="acl"'
                }
            )))
        });
    });
}

fetch.Headers = Headers

module.exports = fetch
