# Solid REST file

## treat a file system as a (very) minimal Solid server

[![NPM](https://nodei.co/npm/solid-rest-file.png)](https://nodei.co/npm/solid-rest-file/)

<p>
Implements a subset of the [Solid REST Specification](https://github.com/solid/solid-spec/blob/master/api-rest.md) for file-systems.  Supports
addressing the file system with file:// IRIs and returns an HTTP
<<<<<<< HEAD
response object with appropriate status codes and headers.  The library may be used stand-alone but is more likely to be used indirectly via rdflib and other Solid tools which support nodejs.  
=======
response object with appropriate status codes and headers.  The library may be used stand-alone but is more likely to be used indirectly via rdflib and other Solid tools which support nodejs.  The [stand-alone test](./tests/test.js) and [rdflib test](./tests/rdflib.test.js) contain examples of common usage.
>>>>>>> 0f643bae6e432a0ebc15d5f79a37ee1489fab86f
</p>
Not implemented: HEAD, OPTION and PATCH (and therefore rdflib's Updater).

**Note**: this library incorporates and extends Thomas Bergwinki's excellent [file-fetch](https://github.com/bergos/file-fetch)

## Using this library with rdflib other Solid Tools

Although this library may be used stand-alone, it is meant primarily for use with other Solid tools. This library is included in solid-auth-cli, the nodejs auth/fetch library for Solid which is itself included in rdflib.js and solid-file-client and (soon) query-ldflex. When used with rdflib.js in nodejs context, it supports all fetcher methods (load, putBack, webOperation, etc.) on local files and folders.

Here's how to use this library with  rdflib:

  ```javascript
  const $rdf = require('rdflib^0.20.0');
  const auth = require('solid-auth-cli^0.2.0'); // includes solid-rest-file
  const store = $rdf.graph();
  const fetcher = $rdf.fetcher(store,{fetch:auth.fetch});
  /*
    you can now use any rdflib methods excpet updater to 
    create, delete, access, and query file:// resources
    if you use auth.login, you can also move resources 
    between a remote Pod and your local file system.
  */
  ```

## Requests

This library expects IRIs that start with "file://" and are followed by
a full pathname. A file located at /home/me/somepath/somefile.txt
would be requested like this:

   ```
  file:///home/me/somepath/somefile.txt
   ```

Note the three slashes in the pathname.

A GET request uses fetch() with a single parameter: the pathname of the resource requested.  The resource is returned as a readable stream which will be the contents of a file, or, if a Container is requested, the stream will be a Turtle representation of the Container including a list of the resources it contains.

  ```javascript
  const fetch = require("solid-rest-file");
  const path  = require("path");
  const file  = "file://"+ path.join(process.cwd(), "foo.txt");
  fetch( file ).then( response => {
      if(response.ok) {
          response.text().then( txt => {
              console.log(txt)
          }, err => {"read error : "});
      }
      else {
          console.log( response.status, response.statusText );
      }
  },err=>{"fetch error : "+err});
  ```

All other requests use fetch() with two parameters, the pathname and a set of options as specified in the [Solid REST Specification](https://github.com/solid/solid-spec/blob/master/api-rest.md).  For example, to create a new Container at the location /somepath/morepath/newFolder

  ```javascript
  fetch( "file:///somepath/morepath", {
      "Method":"POST",
      headers: { 
          Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
          "Content-Type": "text/turtle",
          Slug: newFolder
      }
  }).then( ...

  ```
As per the spec, this will fail if the containing folder "/somepath/morepath" does not already exist.  Use PUT to create a resource and its container. PUT on a Container by itself is not suppoted.

## Responses

* POST Container
   * 201 on success
   * 404 if the Container of the Container does not exist
   * returns created path in location header
* POST Resource
   * 201 on success
   * 404 if the Container of the new Resource does not exist
   * returns created path in location header
* PUT Resource
   * 201 on success
   * creates Container of the new Resource if it does not exist
   * returns created path in location header
* PUT Container
   * 405 method not supported
* GET Resource
   * 200 on success
   * 404 if not found
   * returns body of resource as a readable stream in response.body
   * returns content-type in header
* GET Container
   * 200 on success
   * 404 on not found
   * returns turtle representation of ldp:BasicContainer as readable stream
* DELETE Resource
* DELETE Container
   * 200 on success
   * 404 on not found
   * 409 on Container-not-empty or other failure
* All other methods
   * 405 method not supported

copyright &copy; 2019, Jeff Zucker, may be freely distributed with the MIT license
