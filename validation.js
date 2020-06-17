const Joi = require('@hapi/joi')

const adminloginValidation = data => {
    const schema = Joi.object({
        email:Joi.string().required().email(),
        password:Joi.string().min(8).required()
    })

    return schema.validate(data)
}

const changePasswordValidation = data => {
    const schema = Joi.object({
        currentPassword:Joi.string().min(8).required(),
        newPassword:Joi.string().min(8).required().disallow(Joi.ref('currentPassword')).error((err) => {
            if(err[0].code==='any.invalid')
                err[0].message = "New Password must be different from current password"
            return err
        })
    })

    return schema.validate(data)
}

const registerValidation = data => {
    const schema = Joi.object({
        name : Joi.string().min(3).required(),
        email : Joi.string().required().email(),
        regno : Joi.string().required().min(15).max(15),
        password : Joi.string().min(8).required(),
        dept : Joi.string().min(3).required(),
        year : Joi.required(),
        domain : Joi.required()
    })

    return schema.validate(data)
}

const loginValidation = data => {
    const schema = Joi.object({
        email:Joi.string().required().email(),
        password:Joi.string().min(8).required()
    })

    return schema.validate(data)
}

module.exports.registerValidation = registerValidation
module.exports.loginValidation = loginValidation
module.exports.changePasswordValidation = changePasswordValidation
module.exports.adminloginValidation = adminloginValidation