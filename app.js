const express = require('express')
const app = express()

const Joi = require('@hapi/joi')

const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')

const mongoClient = require('mongodb').MongoClient
const objectId = require('mongodb').ObjectId

const nodemailer = require('nodemailer')

const request = require('request')

const {OAuth2Client} = require('google-auth-library')
const client = new OAuth2Client("523384873779-e29ttamvfnbfkhb650ppufoas5qmr328.apps.googleusercontent.com")

const ejs = require('ejs')
app.set('view engine','ejs')

const schema = Joi.object({
    email : Joi.string().required().email(),
    password : Joi.string().min(8).required()
})

app.use(express.urlencoded({extended:false}))
app.use(express.json())

app.get('/', (req,res)=>{
    res.render('register')
})

let host;

app.post('/register', (req,res)=>{

    if(
        req.body.captcha === undefined ||
        req.body.captcha === '' ||
        req.body.captcha === null
    ){
        return res.json({"success":false, "msg":"Please select captcha"})
    }

    const secretKey = '6Lfie_kUAAAAAAYZM0z0uetf7cs8pFQ4_e567GmN'

    const verifyUrl = `https://google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${req.body.captcha}&remoteip=${req.connection.remoteAddress}`

    request(verifyUrl, (err, response, body) => {
        body = JSON.parse(body)

        if(body.success !== undefined && !body.success){
            return res.json({"success":false, "msg":"Failed captcha verification"})
        }

        console.log("captcha succesful")

        let { error } = schema.validate({email: req.body.email, password: req.body.password})
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
                        email : req.body.email,
                        password : hashedPassword,
                        userType : 0,
                        verified : 0,
                        registered : 0
                    }

                    dbo.collection('users').insertOne(userInfo, (dbErr,result)=>{
                        if(dbErr) throw dbErr

                        host = req.get('host')
                        rand = result.insertedId
                        link = "http://"+req.get('host')+"/verify?id="+rand;

                        let transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                            user: process.env.EMAIL,
                            pass: process.env.PASSWORD
                            },
                            tls:{
                            rejectUnauthorized:false
                            }
                        });
                        
                        let mailOptions = {
                            from: process.env.EMAIL,
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

//Normal Email Login
app.post('/login', (req,res) =>{

    mongoClient.connect(process.env.DB_CONNECT, {useUnifiedTopology : true}, (err,db) => {
        
        if(err) throw err
        
        let dbo = db.db('atom')

        dbo.collection('users').findOne({email : req.body.email}, (dbErr, user)=>{

            if(dbErr) throw dbErr

            if(!user) return res.status(400).send("user does not exist")

            console.log("user found")

                if(user.verified)
                {
                    console.log("user is verified")
                    if(bcrypt.compareSync(req.body.password,user.password))
                    {
                        app.set('loggedUser', user)
                        console.log("logged user :" + app.get('loggedUser'))
                        /* if(user.userType === 0) */
                            res.redirect('/userRegister')
                        /* else 
                            res.redirect('/memberDash') */
                    }
                    else
                    {
                        return res.status(400).send("Password does not match")
                    }
                }
                else 
                {
                    return res.status(400).send("User is not verified..please check email for verification link")
                }
        })
    })
})

//Google Log In
app.post('/googleLogIn', (req,res) => {

    console.log("in googleLogIn route")

    async function verify() {
        const ticket = await client.verifyIdToken({
            idToken: req.body.id_token,
            audience: "523384873779-e29ttamvfnbfkhb650ppufoas5qmr328.apps.googleusercontent.com"
        })
        const payload = ticket.getPayload()
        console.log(payload)
        const userid = payload['sub']
        const email = payload['email']
        
        mongoClient.connect(process.env.DB_CONNECT, {useUnifiedTopology : true}, (err,db) => {
        
            if(err) throw err
            
            let dbo = db.db('atom')
    
            dbo.collection('users').findOne({userid}, (dbErr, user)=>{
    
                if(dbErr) throw dbErr
    
                if(!user) {

                    let userInfo = {
                        userid,
                        email,
                        userType : 0,
                        registered : 0
                    }

                    dbo.collection('users').insertOne(userInfo, (dbErr,result)=>{
                        if(dbErr) throw dbErr

                        console.log("inserted user", result)
                        res.redirect('/userRegister')
                    })
                }
                else{
                    console.log("user exists")
                    res.redirect('/userRegister')
                }
            })
        })

    }
    verify().catch(error => {
        console.log('hi')
    })
})

app.get('/primarydash', (req,res) =>{

    let loggedUser = app.get('loggedUser')

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db) =>{
        if(err) throw err

        let dbo = db.db("atom")

        let query = { domain : loggedUser.domain1 }

        dbo.collection("events").find(query).toArray((dbErr,result)=>{
            if(dbErr) throw dbErr

            let today = new Date()

            res.render('primary', {result , today})
        })
    })

})

app.get('/secondarydash', (req,res) =>{

    let loggedUser = app.get('loggedUser')

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db) =>{
        if(err) throw err

        let dbo = db.db("atom")

        let query = { domain : loggedUser.domain2 }

        dbo.collection("events").find(query).toArray((dbErr,result)=>{
            if(dbErr) throw dbErr

            let today = new Date()

            res.render('secondary', {result , today})
        })
    })

})

app.get('/profile', (req,res) =>{
    res.render('profile', {user : app.get('loggedUser')})
})

app.get('/userRegister', (req,res) =>{
    let loggedUser = app.get('loggedUser')
        res.render('userRegister', {registerStatus : loggedUser.registered})
})

const schema2 = Joi.object({
    name : Joi.string().min(3).required(),
    regno : Joi.string().required().min(15).max(15),
    dept : Joi.string().min(3).required(),
    year : Joi.required(),
    batch : Joi.required(),
    contactno : Joi.string().min(10).max(10).required(),
    whatsappno : Joi.string().min(10).max(10).required(),
    domain1 : Joi.required(),
    domain2 : Joi.required().disallow(Joi.ref('domain1')).error((err) => {
        if(err[0].code==='any.invalid')
            err[0].message = "Both Domains shpuld be different"
        return err
    })
})

app.post('/userRegister', (req,res) =>{

    let { error } = schema2.validate(req.body)
    if(error) return res.send(error.details[0].message)

    let loggedUser = app.get('loggedUser')

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db)=>{
        if(err) throw err

        let dbo = db.db("atom")
        let userInfo = {
            name : req.body.name,
            regno : req.body.regno,
            dept : req.body.dept,
            year : req.body.year,
            batch : req.body.batch,
            contactno : req.body.contactno,
            whatsappno : req.body.whatsappno,
            domain1 : req.body.domain1,
            domain2 : req.body.domain2,
            registered : 1
        }

        dbo.collection('users').updateOne({email : loggedUser.email},  { $set: userInfo }, async(dbErr, result)=>{
            if(dbErr) throw dbErr

            console.log("registerarion done")

        })
        
    })
    res.render('userRegister')
})

app.post('/attendance', (req,res) => {
    let loggedUser = app.get('loggedUser')

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db)=>{
        if(err) throw err

        let dbo = db.db("atom")

        let email = loggedUser.email
        let name = loggedUser.name

        dbo.collection('events').findOne({_id : new objectId(req.body.id) },(dbErr, result) =>{
                if(dbErr) throw dbErr

                if(result.attendance){

                    for(let i=0; i<result.attendance.length; i++){
                        if(email === result.attendance[0].email)
                        {
                            console.log("given atn")
                            return res.json({msg:"already marked attendance"})
                            break
                        }
                    }
                }
                
                let attendInfo = {
                    name,
                    email,
                    willAttend : req.body.attendance
                }
    
                dbo.collection('events').updateOne({_id : new objectId(req.body.id) },  { $push :{ attendance:  attendInfo }}, async(dbErr, result)=>{
                    if(dbErr) throw dbErr
            
                    console.log("attendance marked")
    
                })
                res.json({msg : "Thankyou for response of attendance"})
        })
        
    })

})

app.post('/feedback', (req,res) => {
    let loggedUser = app.get('loggedUser')

    console.log("reached feedback route")

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db)=>{
        if(err) throw err

        let dbo = db.db("atom")
        let feedbackInfo = {
            name : loggedUser.name,
            email : loggedUser.email,
            environment : req.body.env,
            speaker : req.body.speaker,
            understanding : req.body.understanding,
            suggestion : req.body.suggestion
        }

        dbo.collection('events').updateOne({_id : new objectId(req.body.id) },  { $push :{ feedback:  feedbackInfo }}, async(dbErr, result)=>{
            if(dbErr) throw dbErr
        
            console.log("feedback taken")

        })
        res.json({msg : "Thankyou for giving feedback"})
    })

})

app.get('/forgotpassword', (req,res) => {
    res.render('forgotpassword')
})

app.post('/forgotpassword', (req,res) => {

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db)=>{
        if(err) throw err

        let dbo = db.db("atom")

        dbo.collection('users').findOne({email : req.body.email }, (dbErr, result)=>{

            if(dbErr) throw dbErr

            if(!result) return res.json({msg:"no such user found"})
        
            host = req.get('host')
            rand = result._id
            link = "http://"+req.get('host')+"/verifypasswordlink?id="+rand;

            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                  user: process.env.EMAIL,
                  pass: process.env.PASSWORD
                },
                tls:{
                  rejectUnauthorized:false
                }
            });
              
            let mailOptions = {
                from: process.env.EMAIL,
                to: req.body.email,
                subject: 'Confirmation email for Tdian register',
                html: "<p>password reset link is...<a href="+link+">Click here to reset....</a></p>"
            };
              
            transporter.sendMail(mailOptions, function(error, info){
                if (error)  console.log(error);
                
                res.json({msg:"Please check your email"});
                
            })

        })
    })

})

app.get('/verifypasswordlink', (req,res) => {

    if((req.protocol+"://"+req.get('host'))==("http://"+host))
    {
        res.render('changepassword', {msg:"", id: req.query.id})
    } 
    else {
        res.render('changepassword',{msg:"request from unknown source", id: ""})
    }
})

const schema3 = Joi.object({
    password : Joi.string().min(8).required()
})

app.post('/changepassword', (req,res) => {

    let password = req.body.newPassword

    let { error } = schema3.validate({password})
    if(error) return res.json({msg:error.details[0].message})

    mongoClient.connect(process.env.DB_CONNECT,{useUnifiedTopology : true},(err,db)=>{
        if(err) throw err


        let dbo = db.db('atom')
        dbo.collection('users').findOne({_id : new objectId(req.body.id)}, async(dbErr, user)=>{
            if(dbErr) throw dbErr
            
            if(!user) res.json({msg:"no such user found"})

            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(password, salt)

            dbo.collection('users').updateOne({"_id" : objectId(req.body.id) }, { $set: {password : hashedPassword} }, async(dbErr, result)=>{

                if(dbErr) throw dbErr

                res.json({msg:"Password updated succesfully"})
            })
        }) 
    })
})

app.listen(3000, (err)=>{
    if(err) throw err
    console.log("App running on 3000") 
})

