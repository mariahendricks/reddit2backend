import { Router, type Request, type Response } from 'express'
import { isValidObjectId } from 'mongoose'
import { Post } from '../models/post'
import { authenticate } from '../middlewares/authenticate'

const vote = async (type: 'up' | 'down', req: Request, res: Response) => {
    try {
        const {postId} = req.params

        if (!req.userId) {
            res.status(401).json({message: 'Missing user id'})
            return
        }

        if (!isValidObjectId(postId)) {
            res.status(400).json({message: 'Invalid post id'})
            return
        }

        const post = await Post.findById(postId)

        if(!post) {
            res.status(404).json({ message: 'Post not found'})
            return
        }

        switch (type) {
            case 'up':
                post.upvote(req.userId)
                break

            case 'down':
            post.downvote(req.userId)
            break
        }

        await post.save()
        res.status(200).json({message: 'Vote registered'})

    } catch (error) {
        console.error(error)
        res.status(500).send()
    }
}

export const voteRouter = Router()

voteRouter.put('/votes/:postId/upvote', authenticate, (req, res) => 
    vote('up', req, res))
voteRouter.put('/votes/:postId/downvote', authenticate, (req, res) => 
    vote('down', req, res))