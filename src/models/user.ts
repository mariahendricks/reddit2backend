import { type Document, model, MongooseError, Schema } from "mongoose";
import bcrypt from "bcrypt";

type TUser = Document & {
    username: string,
    password: string,
    createdAt: Date,
    updatedAt: Date
}

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false,
    },
}, {
    timestamps: true,    
    }
)

UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        next()
    }

    try {
        const hashedPassword = await bcrypt.hash(this.password, 10)
        this.password = hashedPassword

        next()
    } catch (error) {
        if (error instanceof MongooseError) { 
            next(error) 
        }
        throw error
    }
})

export const User = model<TUser>('User', UserSchema)