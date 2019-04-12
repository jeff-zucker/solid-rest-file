#!/usr/bin/env node
const solid = { auth : require('solid-auth-cli') };
const $rdf  = require('rdflib')
const path  = require("path")
let store   = $rdf.graph()                 
let fetcher = $rdf.fetcher(store,{fetch:solid.auth.fetch})

const base = process.cwd();
const foldername = "test2";
const filename = "file-test.ttl";
const folder = "file://"+path.join( base,foldername );
const file = "file://"+path.join( base,foldername,filename );
const other = "X"+filename;
const msg = "hello world";
const DOC = $rdf.Namespace(file);

function ok(expected,got){
    console.log( expected===got ? "ok" : "fail "+got );
}

async function run(){
    ok( 201, await postContainer("file://"+base,foldername) );
    ok( 201, await putResource(file) );
    ok( 201, await postResource(folder,other) );
    ok( true, await getResource(file) );
    ok( true, await getContainer(folder) );
    ok( 200, await deleteResource(file) );
    ok( 200, await deleteResource(folder+"/"+other) );
    ok( 200, await deleteResource(folder) );
}
if(typeof test !="undefined"){
test('POST Container',()=>{
    return expect(postContainer("file://"+base,foldername)).resolves.toBe(201);
});
test('POST Resource',()=>{
    return expect(postResource(folder,other)).resolves.toBe(201);
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
    expect(deleteResource(file)).resolves.toBe(200)
    return expect(deleteResource(folder+"/"+other)).resolves.toBe(200)
});
test('DELETE Container',()=>{
    return expect(deleteResource(folder)).resolves.toBe(200)
});
}
else{
  run()
}

async function getResource(file){
    emptyStore()
    let res = await fetcher.load(file);
    if( res.status != 200 ) return false;
    res = store.any( DOC("#test"),DOC("#message"),null)
    return( res.value === msg );
}
async function putResource(file){
    store.add( DOC("#test"), DOC("#message"), msg, DOC("") );
    let res = await fetcher.putBack(file);
    return res.status;
}
async function postResource(folder,file){
    let results;
    let link='<http://www.w3.org/ns/ldp#Resource>; rel="type"';
    try { results = await fetcher.webOperation('POST',folder,{
        body: msg,
        headers: { Link:link, Slug:file },
        contentType:"text/turtle",
    })
   }
   catch(err) { results = err.response; }
   return (results.status);
}
async function postContainer(container,newFolder){
    let results;
    let link='<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"';
    try { results = await fetcher.webOperation('POST',container,{
        headers: { Slug:newFolder, Link:link, "Content-type":"text/turtle" }
    })  }
    catch(err) { results = err.response; }
    return (results.status);
}
async function getContainer(pathname){
    emptyStore();
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
    return (files.length===2)
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
