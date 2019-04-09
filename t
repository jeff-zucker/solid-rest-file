const fetch = require("./src");
const path  = require("path");
const file  = path.join("file://",process.cwd(), "t");
fetch( file ).then( response => {
    if(response.ok) {
        response.text().then( txt => {
            console.log(txt)
        }, err => {"read error : "});
    }
    else console.log( response.status, response.statusText );
},err=>{"fetch error : "+err});
