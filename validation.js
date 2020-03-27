const Joi = require('@hapi/joi')

const adminloginValidation = data => {
    const schema = Joi.object({
        email:Joi.string().required().email(),
        password:Joi.string().min(8).required()
    })

    return schema.validate(data)
}

const passwordValidation = data => {
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

module.exports.passwordValidation = passwordValidation
module.exports.adminloginValidation = adminloginValidation