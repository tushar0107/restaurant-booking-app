const sqlite = require('sqlite3').verbose();

const db = new sqlite.Database('restrodb.db',(err)=>{
    if(err){
        console.log('Error connecting Database');
    }
    console.log('Database Connected successfully');
});

module.exports = db;