#!/usr/bin/env node
const solid = { auth : require('solid-auth-cli') };
const $rdf  = require('rdflib')
const path  = require("path")
let store   = $rdf.graph()                 
let fetcher = $rdf.fetcher(store,{fetch:solid.auth.fetch})

const base  = path.join("file://",process.cwd());
const foldername  = "test";
const filename   = "file-test.ttl";
const folder   = path.join( base,foldername );
const file    = path.join( folder, filename );
const msg     = "hello world";


const DOC = $rdf.Namespace(file);

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

async function getResource(file){
    emptyStore()
    let res = await fetcher.load(file);
    if( res.status != 200 ) return false;
    res = store.any( DOC("#test"),DOC("#message"),null)
    return( res.value === msg );
}
async function putResource(){
    store.add( DOC("#test"), DOC("#message"), msg, DOC("") );
    let res = await fetcher.putBack(file);
    return res.status;
}
async function postResource(folder,file){
    let results;
    try { results = await fetcher.webOperation('POST',folder,{
        "Link": '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
        "contentType": "text/turtle",
        "Slug":file,
        "body": "foobar"
    })  }
    catch(err) { results = err.response; }
    return (results.status);
}
async function postContainer(container,newFolder){
    let results;
    try { results = await fetcher.webOperation('POST',container,{
        "contentType": "text/turtle",
        "Link": '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
        "Slug": newFolder
    })  }
    catch(err) { results = err.response; }
    return (results.status);
}
async function getContainer(pathname){
    let ocon = console.log;
    console.log = function(){}
    let results;
    try { results = await fetcher.load(pathname); }
    catch(err) { results = err.response; }
    console.log = ocon;
    if( results.status != 200 ) return false;
    const LDP = $rdf.Namespace("http://www.w3.org/ns/ldp#");
    let folder = $rdf.sym(pathname);
    let files = store.each(folder, LDP("contains"));
    results = (files.length===2)
    if(results) return true;
    return false;
}
async function deleteResource(pathname){
    let results;
    try { results = await fetcher.webOperation('DELETE',pathname);  }
    catch(err) { results = err.response; }
    return results.status;
}
function emptyStore(){
    store = $rdf.graph()
    fetcher = $rdf.fetcher(store,{fetch:solid.auth.fetch})
}
/*
test('DELETE Container fails with 409 if non-empty', () => {
    expect( deleteResource(folder) ).resolves.toBe(409);
});

test('POST Container fails with 409 if already esists', () => {
    expect( postContainer(folder) ).resolves.toBe(409);
});

*/
