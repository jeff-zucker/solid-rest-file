#!/usr/bin/env node
const fetch = require('../src');
const path  = require("path")

const folder  = "file://" + path.join(process.cwd(),"test");
const file    = path.join( folder,"file-test.ttl");
const msg     = "hello world";


/*
putResource(file).then(res=>{
    console.log(res)
},err=>{console.log("Error : "+err)})
*/
test('POST Container',()=>{
    return expect(postContainer(folder)).resolves.toBe(201);
});
test('POST Resource',()=>{
    return expect(postResource(file+"X")).resolves.toBe(201);
});
test('PUT Resource',  ()=>{
    return expect(putResource(file)).resolves.toBe(201);
});
test('GET Resource',  ()=>{
    return expect(getResource(file)).resolves.toBe(true);
});
test('GET Container', ()=>{
    return expect(getContainer(folder)).resolves.toBe(true);
});
test('DELETE Resource',()=>{
    expect(deleteResource(file)).resolves.toBe(204)
    return expect(deleteResource(file+"X")).resolves.toBe(204)
});
test('DELETE Container',()=>{
    return expect(deleteResource(folder)).resolves.toBe(204)
});

async function getResource(file){
    let res = await fetch(file);
    if( res.status != 200 ) return false;
    let txt = await res.text()
    return( txt === msg );
}
async function putResource(){
    let res = await fetch(file,{method:"PUT",body:msg});
    return res.status;
}
async function postResource(pathname){
    let results;
    try { results = await fetch(pathname,{
        "method":"POST",
        "Link": '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
        "contentType": "text/turtle",
        "body": msg
    })  }
    catch(err) { results = err.response; console.log(err) }
    return (results.status);
}
async function postContainer(pathname){
    let results;
    try { results = await fetch(pathname, {
        "method":"POST",
        "contentType": "text/turtle",
        "Link": '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"'
    })  }
    catch(err) { results = err.response; }
    return (results.status);
}
async function getContainer(pathname){
    let results;
    try { results = await fetch(pathname); }
    catch(err) { results = err.response; }
    if( results.status != 200 ) return false;
    return true;
}
async function deleteResource(pathname){
    let results;
    try { results = await fetch(pathname,{method:"DELETE"});  }
    catch(err) { results = err.response; }
    return results.status;
}
