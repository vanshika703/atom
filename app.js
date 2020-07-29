const express = require('express')
const app = express()
const mongodb = require('mongodb')
const session = require('express-session')
const ejs = require('ejs')
const dotenv = require('dotenv')
dotenv.config()

app.use(express.urlencoded({extended:false}))
app.use(express.json())
app.use(session({
    secret:"dsudbfusidncs",
    resave:true,
    saveUninitialized:false
}))

app.use(express.static(__dirname + '/views'))
app.set("view engine","ejs")

const mongoClient = mongodb.MongoClient
const url = process.env.DB_URL

const adminRoute = require('./routes/admin')
app.use('/admin',adminRoute)
const userRoute = require('./routes/user')
app.use('/user',userRoute)

app.all('*',(req,res) => {
    res.render('404')
}) 

var PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`server up at http://localhost:${PORT}`)
    mongoClient.connect(url,{useUnifiedTopology:true},(err,db) => {
        if(err) throw err

        app.locals.db = db
        console.log("And db connected")
    })
})