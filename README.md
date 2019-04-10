# Solid REST file

## treat a file system as a (very) minimal Solid server

Implements a subset of the [Solid REST Specification](https://github.com/solid/solid-spec/blob/master/api-rest.md) for file-systems.  Supports
addressing the file system with file:// IRIs and returns an HTTP
response object with appropriate status codes and headers.  When used
with rdflib.js in nodejs context, it supports all fetcher methods 
(load, putBack, webOperation, etc.) on local files and folders.

Not implemented: HEAD, OPTION and PATCH (and therefore rdflib's Updater).

**Note**: this library incorporates and extends Thomas Bergwinki's excellent [file-fetch](https://github.com/bergos/file-fetch)

## Requests

This library expects IRIs that start with "file://" and are followed by
a full pathname. A file located at /home/me/somepath/somefile.txt
would be requested like this:

   ```
  file:///home/me/somepath/somefile.txt
   ```

Note the three slashes in the pathname.

A GET request uses fetch() with a single parameter: the pathname of the resource requested

  ```javascript
  const fetch = require("solid-rest-file");
  const path  = require("path");
  const file  = path.join("file://",process.cwd(), "foo.txt");
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
      "Content-Type": "text/turtle",
      "Link": '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
      "Slug": "newFolder"
   }).then( ...

  ```
As per the spec, this will fail if the containing folder "/somepath/morepath" does not already exist.

## Responses

* POST Container
   * 201 on success
   * 404 if the Container of the Container does not exist
   * 409 if Container pre-exists or other failure
   * returns created path in location header
* POST Resource
   * 201 on success
   * 404 if the Container of the new Resource does not exist
   * 406 on body empty
   * 500 on other failure
   * returns created path in location header
* PUT Resource
   * same as POST Resouce except if containing folder is not found, it is created (including intermediary folders if needed)
* GET Resource
   * 200 on success
   * 404 if not found
   * 500 on other failure
   * returns body of resource as a readable stream in response.body
   * returns content-type in header
* GET Container
   * 200 on success
   * 404 on not found
   * 500 on other failure
   * returns turtle representation of ldp:BasicContainer as readable stream
* DELETE Resource
* DELETE Container
   * 204 on success
   * 404 on not found
   * 409 on Container-not-empty or other failure
