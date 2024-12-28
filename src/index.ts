import express from 'express';
import mongoose from 'mongoose';
import 'dotenv/config';
import { postRouter } from './routes/post';
import { authRouter } from './routes/auth';
import { profileRouter } from './routes/profile';
import cors from 'cors';
import { voteRouter } from './routes/vote';

const app = express()
app.use(express.json())
app.use(cors())

app.use(postRouter)
app.use(authRouter)
app.use(profileRouter)
app.use(voteRouter)

mongoose.connect(process.env.DB_URL!).then(() => {
    const port = process.env.PORT || '8080'

    app.listen(port, () => {
        console.log(`listening on http://localhost:${port}/`)
    })
})