const Router = require('express').Router()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId
const mongoClient = mongodb.MongoClient
const url = process.env.DB_URL
const bcrypt = require('bcryptjs')
const {adminloginValidation,passwordValidation} = require('../validation')

Router.get("/login", (req,res) => {
    res.render("adminlogin",{msg:''})
})

Router.get("/register", (req,res) => {
    res.render("adminregister",{msg:''})
})

Router.post('/register', (req,res) => {
    
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

        dbo.collection('admins').insertOne(newData, (dbErr,result) => {
            if(dbErr) throw dbErr

            console.log("inserted"+result.insertedCount)
            res.status(200).send("Registered!")
        })
    })
})


Router.post('/login', (req,res) => {

    let {error} = adminloginValidation(req.body)
    if(error) return res.status(400).send(error.details[0].message)
    
    mongoClient.connect(url, {useUnifiedTopology:true} , (err,db) => {
        let dbo = db.db('atom')

        dbo.collection('admins').find({email:req.body.email}).toArray((dbErr,result) => {
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

Router.use((req,res,next) => {
    if(req.session.user) next()
    else res.render('adminlogin',{msg:"Please login to continue"})
})

Router.get('/dashboard', (req,res) => {
    res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0')
    res.render('admindashboard',{user:req.session.user})
})


Router.get('/changePassword', (req,res) => {
    res.render('adminchangepassword')
})

Router.post('/changePassword',(req,res) => {

    let {error} = passwordValidation(req.body)
    if(error) return res.status(400).send(error.details[0].message) 
    
    mongoClient.connect(url, {useUnifiedTopology:true},(err,db) => {
        let dbo = db.db('atom')
        
        dbo.collection('admins').findOne({_id:new ObjectId(req.session.user.id)},(dbErr,user) => {
            if(dbErr) throw dbErr
            
            if(!bcrypt.compareSync(req.body.currentPassword,user.password)) return res.status(400).send('Current Password is incorrect')
            
            const salt = bcrypt.genSaltSync(10)
            const hashed = bcrypt.hashSync(req.body.newPassword,salt)
            dbo.collection('admins').updateOne({_id:new ObjectId(req.session.user.id)},{$set:{password:hashed}}, (dbErr,result) => {
                if(dbErr) throw dbErr 
                
                console.log(result)
                res.send('Password Updated')
            })
        })
    })
})

Router.post('/addInfo',(req,res) => {
    
    req.body.addedBy = req.session.user.name

    mongoClient.connect(url,{useUnifiedTopology:true},(err,db) => {
        if(err) throw err

        let dbo = db.db('atom')

        dbo.collection('events').insertOne(req.body,(dbErr,result) => {
            if(dbErr) throw dbErr
            
            console.log(result.insertedCount)
            res.send({msg:"Info added"})
        })
        
    })
})

Router.get('/viewInfo', (req,res) => {
    
    mongoClient.connect(url,{useUnifiedTopology:true},(err,db) => {
        if(err) throw err

        let dbo=db.db('atom')

        dbo.collection('events').find({}).toArray((dbErr,data) => {
            if(dbErr) throw dbErr

            res.render('adminviewinfo',{data:data})
        })
    })
})

Router.get('/viewMembers', (req,res) => {
    
    mongoClient.connect(url,{useUnifiedTopology:true}, (err,db) => {
        if(err) throw err

        let dbo= db.db('atom')

        dbo.collection('users').find({ userType: 1 },{projection:{password:0}}).toArray((dbErr, tdians) => {
            if (dbErr) throw dbErr
            
            res.render('adminviewmembers',{data:tdians})
        })
    })
})

Router.get('/viewUsers', (req,res) => {

    mongoClient.connect(url, {useUnifiedTopology:true}, (err,db) => {
        if(err) throw err
        
        db.db('atom').collection('users').find({userType:0},{projection:{password:0}}).toArray((dbErr,ntdians) => {
            if(dbErr) throw dbErr

            res.render('adminviewusers',{data:ntdians})
        })
    })
})

Router.post('/delete', (req,res) => {
    let id = req.body.id
    
    mongoClient.connect(url, {useUnifiedTopology:true} , (err,db) => {
        if(err) throw err
        
        db.db('atom').collection('users').deleteOne({_id:new ObjectId(id)},(dbErr,result) => {
            if(dbErr) throw dbErr
            
            console.log(result.deletedCount)
            res.send({msg:'deleted'})
        })
    })
})

Router.post('/promote', (req,res) => {
    let id = req.body.id

    mongoClient.connect(url, {useUnifiedTopology:true} , (err,db) => {
        if(err) throw err

        db.db('atom').collection('users').updateOne({_id:new ObjectId(id)},{$set:{userType:1}},(dbErr,result) => {
            if(dbErr) throw dbErr
            
            console.log(result.modifiedCount)
            res.send({msg:'promoted'})
        })
    })
})

Router.get('/addTask',(req,res) => {
    mongoClient.connect(url,{useUnifiedTopology:true}, (err,db) => {
        if(err) throw err

        let dbo= db.db('atom')

        dbo.collection('users').find({ userType: 1 },{projection:{password:0}}).toArray((dbErr, tdians) => {
            if (dbErr) throw dbErr
            
            res.render('adminaddtask',{data:tdians})
        })
    })
})

Router.post('/addTask',async(req,res) => {
    req.body.addedBy = req.session.user.name

    mongoClient.connect(url,{useUnifiedTopology:true},(err,db) => {
        if(err) throw err
        
        db.db('atom').collection('tasks').insertOne(req.body,(dbErr,result) => {
            if(dbErr) throw dbErr

            console.log(result.insertedCount)
            res.send({msg:'Task added. Page reloading in 2 seconds'})
        })
    })
})


Router.all('/logout', (req,res) => {
    req.session.destroy()
    res.render('adminlogin',{msg : "you have been logged out"})
})

module.exports = Router