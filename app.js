const express = require('express')
const app = express()

const Joi = require('@hapi/joi')

const jwt = require('jsonwebtoken')

const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')

const mongoClient = require('mongodb').MongoClient
const objectId = require('mongodb').ObjectId

const nodemailer = require('nodemailer')

const ejs = require('ejs')
app.set('view engine','ejs')

const schema = Joi.object({
    name : Joi.string().min(3).required(),
    email : Joi.string().required().email(),
    regno : Joi.string().required().min(15).max(15),
    password : Joi.string().min(8).required(),
    dept : Joi.string().min(3).required(),
    year : Joi.required(),
    domain : Joi.required()
})

app.use(express.urlencoded({extended:false}))
app.use(express.json())

app.get('/', (req,res)=>{
    res.render('register')
})

let host;

app.post('/register', (req,res)=>{

    let { error } = schema.validate(req.body)
    if(error) return res.send(error.details[0].message)

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db)=>{
        if(err) throw err

        let dbo = db.db("atom")

        dbo.collection('users').findOne({email : req.body.email}, async(dbErr, user)=>{
            if(dbErr) throw dbErr

            //if user exists
            if(user)
                res.send("Email exists")
            else{
                //hashing password
                const salt = await bcrypt.genSalt(10)
                const hashedPassword = await bcrypt.hash(req.body.password, salt)

                //new user info
                let userInfo = {
                    name : req.body.name,
                    email : req.body.email,
                    regno : req.body.regno,
                    dept : req.body.dept,
                    year : req.body.year,
                    domain : req.body.domain,
                    password : hashedPassword,
                    userType : 0,
                    verified : 0
                }

                dbo.collection('users').insertOne(userInfo, (dbErr,result)=>{
                    if(dbErr) throw dbErr

                    host = req.get('host')
                    rand = result.insertedId
                    link = "http://"+req.get('host')+"/verify?id="+rand;

                    let transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                          user: 'vanshi.loveart@gmail.com',
                          pass: 'vanshika419'
                        },
                        tls:{
                          rejectUnauthorized:false
                        }
                    });
                      
                    let mailOptions = {
                        from: 'vanshi.loveart@gmail.com',
                        to: req.body.email,
                        subject: 'Confirmation email for Tdian register',
                        html: "<p>link is...<a href="+link+">Click here to verify....</a></p>"
                    };
                      
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                          console.log(error);
                        } else {
                          console.log('Email sent: ' + info.response);
                        }
                    });

                    res.send("Check email for otp")
                })
            }
        })
        
    })
    
})
  
app.get('/verify', (req,res) => {

    console.log("link :"+req.protocol+":/"+req.get('host'))

    if((req.protocol+"://"+req.get('host'))==("http://"+host))
    {
        console.log("Domain matched")

        mongoClient.connect(process.env.DB_CONNECT,{useUnifiedTopology : true},(err,db)=>{
            if(err) throw err

            console.log("db connected")

            let dbo = db.db('atom')
            dbo.collection('users').findOne({_id : req.query.id}, (dbErr, user)=>{
                if(dbErr) throw dbErr
                
                    console.log("user found")

                    dbo.collection('users').updateOne({"_id" : objectId(req.query.id) }, { $set: {verified : 1} }, async(dbErr, result)=>{
 
                        if(dbErr) throw dbErr
                        console.log(result)
                        console.log("User verified in database")
                        res.redirect('/login')
                    })
                }) 
        })
        
    } 
    else {
        res.send("request from unknown source")
    }
})

app.get('/login', (req,res)=>{
    res.render('login')
})

app.post('/login', (req,res) =>{

    mongoClient.connect(process.env.DB_CONNECT, {useUnifiedTopology : true}, (err,db) => {
        
        if(err) throw err
        
        let dbo = db.db('atom')

        dbo.collection('users').findOne({email : req.body.email}, (dbErr, user)=>{

            if(dbErr) throw dbErr
            console.log("user found")

                if(user.verified === 1)
                {
                    console.log("user is verified")
                    if(bcrypt.compareSync(req.body.password,user.password))
                    {
                        app.set('loggedUser', user)
                        console.log("logged user :" + app.get('loggedUser'))
                        /* if(user.userType === 0) */
                            res.redirect('/dash')
                        /* else 
                            res.redirect('/memberDash') */
                    }
                    else
                    {
                        res.send("Password does not match")
                    }
                }
                else 
                {
                    res.send("User is not verified..please check email for verification link")
                }
        })
    })
})

app.get('/dash', (req,res) =>{

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db) =>{
        if(err) throw err

        let dbo = db.db("atom")
        dbo.collection("events").find({}).toArray((dbErr,result)=>{
            if(dbErr) throw dbErr
            let today = new Date()
            res.render('dash', {result , user : app.get('loggedUser'), today})
        })
    })

})

app.get('/profile', (req,res) =>{
    res.render('profile', {user : app.get('loggedUser')})
})

app.listen(3000, (err)=>{
    if(err) throw err
    console.log("App running on 3000") 
})

