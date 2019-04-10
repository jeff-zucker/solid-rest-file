#!/usr/bin/env node
const fetch = require('../src');
const path  = require("path")

const base  = path.join("file://",process.cwd());
const foldername  = "test";
const filename   = "file-test.ttl";
const folder   = path.join( base,foldername );
const file    = path.join( folder, filename );
const msg     = "hello world";

async function run(){
    console.log(
        await postContainer(base,foldername)
    );
}
if(typeof test === "undefined") {
    run();
}
else {
test('POST Container',()=>{
    return expect(postContainer(base,foldername)).resolves.toBe(201);
});
test('POST Resource',()=>{
    return expect(postResource(folder,filename+"X")).resolves.toBe(201);
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
}
async function getResource(file){
    let res = await fetch(file);
    if( res.status != 200 ) return false;
    let txt = await res.text()
    return( txt === msg );
}
async function putResource(){
    let res = await fetch(file,{Method:"PUT",body:msg});
    return res.status;
}
async function postResource(folder,file){
    let results;
    try { results = await fetch(folder,{
        "Method":"POST",
        "Link": '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
        "contentType": "text/turtle",
        "body": msg,
        "Slug": file 
    })  }
    catch(err) { results = err.response; console.log(err) }
    return (results.status);
}
async function postContainer(container,newFolder){
    let results;
    try { results = await fetch( container, {
        "Method":"POST",
        "contentType": "text/turtle",
        "Link": '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
        "Slug": newFolder
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
    try { results = await fetch(pathname,{Method:"DELETE"});  }
    catch(err) { results = err.response; }
    return results.status;
}
