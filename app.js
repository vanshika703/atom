const express = require('express')
const app = express()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId
const session = require('express-session')
const bcrypt = require('bcryptjs')
const ejs = require('ejs')
const dotenv = require('dotenv')
dotenv.config()
const {adminloginValidation,passwordValidation} = require('./validation')


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

app.get("/admin/login", (req,res) => {
    res.render("adminlogin",{msg:''})
})

app.get("/admin/register", (req,res) => {
    res.render("adminregister",{msg:''})
})

app.post('/adminRegister', (req,res) => {
    
    mongoClient.connect(url, {useUnifiedTopology:true}, (err,db) => {
        if(err) throw err

        const salt = bcrypt.genSaltSync(10)
        const hashed = bcrypt.hashSync(req.body.password,salt)

        let newData = {
            name:req.body.name,
            email:req.body.email,
            password: hashed
        }

        let dbo = db.db('atom')

        dbo.collection('admin').insertOne(newData, (dbErr,result) => {
            if(dbErr) throw dbErr

            console.log("inserted"+result.insertedCount)
            res.status(200).send("Registered!")
        })
    })
})

app.post('/adminLogin', (req,res) => {

    let {error} = adminloginValidation(req.body)
    if(error) return res.status(400).send(error.details[0].message)

    mongoClient.connect(url, {useUnifiedTopology:true} , (err,db) => {
        let dbo = db.db('atom')

        dbo.collection('admin').find({email:req.body.email}).toArray((dbErr,result) => {
            if(!result.length || !bcrypt.compareSync(req.body.password,result[0].password)) return res.status(400).send("Email/Password is wrong")

            req.session.user = {
                name:result[0].name,
                email:result[0].email,
                id:result[0]._id
            }

            req.session.user.expires = new Date(
                Date.now() + 1000 * 60 * 60 * 2
            )
            res.end()
        })
    })
})

app.use((req,res,next) => {
    if(req.session.user) next()
    else res.render('adminlogin',{msg:"Please login to continue"})
})

app.get('/admin/dashboard', (req,res) => {
    res.render('admindashboard',{user:req.session.user})
})

app.get('/admin/changePassword', (req,res) => {
    res.render('adminchangepassword')
})

app.post('/admin/changePassword',(req,res) => {

    let {error} = passwordValidation(req.body)
    if(error) return res.status(400).send(error.details[0].message) 
             
    mongoClient.connect(url, {useUnifiedTopology:true},(err,db) => {
        let dbo = db.db('atom')

        dbo.collection('admin').findOne({_id:new ObjectId(req.session.user.id)},(dbErr,user) => {
            if(dbErr) throw dbErr

            if(!bcrypt.compareSync(req.body.currentPassword,user.password)) return res.status(400).send('Current Password is incorrect')

            const salt = bcrypt.genSaltSync(10)
            const hashed = bcrypt.hashSync(req.body.newPassword,salt)
            dbo.collection('admin').updateOne({_id:new ObjectId(req.session.user.id)},{$set:{password:hashed}}, (dbErr,result) => {
                if(dbErr) throw dbErr 

                console.log(result)
                res.send('Password Updated')
            })
        })
    })
})

app.get('/admin/logout', (req,res) => {
    req.session.destroy()
    res.render('adminlogin',{msg : "you have been logged out"})
})

var PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`server up at ${PORT}`))