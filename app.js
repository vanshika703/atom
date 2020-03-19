const express = require('express')
const app = express()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId
const session = require('express-session')
const bcrypt = require('bcryptjs')
const ejs = require('ejs')
const dotenv = require('dotenv')
dotenv.config()
const {registerValidation,loginValidation} = require('./validation')


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

app.get("/", (req,res) => {
    res.render("login",{msg:''})
})

app.get('/register', (req,res) => {
    res.render('register',{msg:''})
})

app.post('/register',(req,res) => {
    const {error} = registerValidation(req.body)

    if(error) return res.status(400).render('register',{msg:error.details[0].message})

    mongoClient.connect(url, {useUnifiedTopology:true}, (err,db) => {
        if(err) throw err

        let dbo = db.db('atom')

        dbo.collection('non-member').find({email:req.body.email}).toArray((dbErr,result) => {
            if(dbErr) throw dbErr

            if(result.length) return res.status(400).render('register',{msg:"Email already exists"})

            const salt = bcrypt.genSaltSync(10)
            const hashed = bcrypt.hashSync(req.body.password,salt)

            const newData = {
                name:req.body.name,
                regno:req.body.regno,
                year:req.body.year,
                email:req.body.email,
                password:hashed
            }

            dbo.collection('non-member').insertOne(newData, (dbErr,result) => {
                if(dbErr) throw dbErr

                console.log("Registered")
            })
            res.render('login',{msg:"You have been registered. Login to continue."})
        })
    })
})

app.post('/login', (req,res) => {
    res.send(req.body)
})

var PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log("server up at 5000"))