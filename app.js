const express = require('express')
const app = express()
const mongodb = require('mongodb')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const ejs = require('ejs')
const dotenv = require('dotenv')
dotenv.config()
const mongoClient = mongodb.MongoClient
const url = process.env.DB_URL

app.use(express.urlencoded({extended:false}))
app.use(express.json())
app.use(session({
    secret:"dsudbfusidncs",
    resave:true,
    saveUninitialized:false,
    store: new MongoStore({ url: process.env.DB_URL})
}))

app.use(express.static(__dirname + '/views'))
app.set("view engine","ejs")

const adminRoute = require('./routes/admin')
app.use('/admin',adminRoute)
const userRoute = require('./routes/user')
app.use('/user',userRoute)

app.get('/',(req,res) => {
    res.redirect('/user/login')
})

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