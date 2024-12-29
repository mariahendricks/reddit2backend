import { Router, type Request, type Response } from "express";
import { isValidObjectId, ObjectId, Types } from "mongoose";
import { Comment, Post } from "../models/post";
import { authenticate } from "../middlewares/authenticate";

type AuthorWithUsername = {
    _id: ObjectId
    username: string
}

const getPosts = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit?.toString() || '10')
        const page = parseInt(req.query.page?.toString() || '1' )

        if (isNaN(page) || isNaN(limit)) {
            res.status(400).json({
                message: 'Limit and page has to be valid numbers'
            })
            return
        }

        //const posts = await Post.find()
          //  .populate('author', 'username')
           // .skip(limit * (page - 1))
           // .limit(limit)

        const posts = await Post.aggregate([
            {
                $addFields: {
                    sortValue: {
                        $divide: [
                            // value 1: score 
                            // add 1 to see 0 as positive score
                            {
                                $add: ['$score', 1]
                            },
                            // value 2: age
                            {
                                $pow: [
                                    {
                                        $add: [
                                            {
                                                $divide: [
                                                    { $subtract: [new Date(), '$createdAt'] }, //age in milliseconds
                                                    1000 * 60 * 60 //convert age to hours
                                                ],
                                            },
                                            // add 1 to avoid division with 0
                                            1,
                                        ],
                                    },
                                    // rececny weight
                                    //the higher the number, the faster old posts will loose rank
                                    1.5,
                                ],
                            },
                        ],
                    },
                },
            },
            //sort in descending order by sortValue 
            { $sort: { sortValue: -1} },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    pipeline: [
                        {
                           $project: {
                                username: 1, 
                           }
                        }
                    ],
                    as: 'author'
                }
            },
            { $unwind: '$author' }
        ])

        const responsePosts = posts.map((post) => {
            const author = post.author as unknown as AuthorWithUsername

            return {
                id: post._id,
                title: post.title.toUpperCase(),
                author: {
                    username: author.username,                    
                },
                content: post.content.length > 150 ? `${post.content.slice(0, 150)}...`: post.content,
                score: post.score,
                upvotes: post.upvotes,
                downvotes: post.downvotes,
                createdAt: new Date(post.createdAt).toLocaleString('sv-SE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                updatedAt: new Date(post.updatedAt).toLocaleString('sv-SE'),
            }
        })

        const totalCount = await Post.countDocuments()
        const totalPages = Math.ceil(totalCount / limit)
        console.log({totalCount, totalPages })

        res.status(200).json({
            posts: responsePosts,
            nextPage: page < totalPages ? page + 1 : null,
        })
    } catch (error) {
        console.error(error)
        res.status(500).send()
    }
}

const getPost = async (req: Request, res: Response) => {
    try {
        const { id } = req.params

        if (!isValidObjectId(id)) {
            res.status(400).json({message: 'Invalid post id'})
            return
        }

        const post = await Post.findById(id)
            .populate('author', 'username')
            .populate({
                path: 'comments', 
                populate: { path: 'author', select: 'username' }
        })

        if (!post) {
            res.status(404).json({message: 'Post not found'})
            return
        }

        const author = post.author as unknown as AuthorWithUsername

        res.status(200).json({
            id: post._id,
            title: post.title.toUpperCase(),
            content: post.content,
            author: {
                id: author._id,
                username: author.username,
            },
            comments: post.comments.map(comment => ({
                ...comment.toObject(),
                createdAt: new Date(comment.createdAt).toLocaleString('sv-SE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                updatedAt: new Date(comment.updatedAt).toLocaleString('sv-SE')
            })),
            createdAt: new Date(post.createdAt).toLocaleString('sv-SE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            }),
            updatedAt: new Date(post.updatedAt).toLocaleString('sv-SE'),
        })
    } catch (error) {
        console.error(error)
        res.status(500).send()
    } 
}

const createPost = async (req: Request, res: Response) => {
    try {
        const { title, content } = req.body

        if (!title || typeof title !== 'string') {
            res.status(400).json({ message: 'Malformed title' })
            return
        }

        if (content !== undefined && typeof content !== 'string') {
            res.status(400).json({ message: 'Malformed content' })
            return
        }

        const post = await Post.create({
            title,
            content,
            author: req. userId
        })

        res.status(201).json({ id: post._id })

    } catch (error) {
        console.error(error)
        res.status(500).send()
    }    
}

const deletePost = async (req: Request, res: Response) => {
    try {
        const {id} = req.params

        if (!isValidObjectId(id)) {
            res.status(400).json({message: 'Invalid post id'})
            return
        }

        const post = await Post.findById(id)

        if (!post) {
            res.status(404).json({message: 'Post not found'})
            return
        }

        if (post.author.toString() !== req.userId) {
            res.status(403).json({message: 'You are not allowed to delete this post'})
            return
        }

        await post.deleteOne()
        res.status(200).json({message: 'Post deleted'})

    } catch(error) {
        console.error(error)
        res.status(500).send()
    }
}

const editPost = async(req: Request, res: Response) => {
    try {
        const { id } = req.params

        if (!isValidObjectId(id)) {
            res.status(400).json({message: 'Invalid post id'})
            return
        }

        const post = await Post.findById(id)

        if (!post) {
            res.status(404).json({message: 'Post not found'})
            return
        }

        if (post.author.toString() !== req.userId) {
            res.status(403).json({message: 'You are not allowed to edit this post'})
            return
        }

        const {title, content} = req.body

        if (title !== undefined && typeof title !== 'string') {
            res.status(400).json({message: 'Malformed title'})
            return
        }

        if (content !== undefined && typeof content !== 'string') {
            res.status(400).json({message: 'Malformed content'})
            return
        }

        await post.updateOne({
            title,
            content,
        })
        res.status(200).json({message: 'Post updated'})
    
    } catch(error) {
        console.error(error)
        res.status(500).send()
    }
}

const addComment = async(req: Request, res: Response) => {
    try {
        const { content } = req.body
        const { id: postId } = req.params
        
        if (!isValidObjectId(postId)) {
            res.status(400).json({message: 'Invalid post id'})
            return
        }

        if (!content || typeof content !== 'string') {
            res.status(400).json({ message: 'Malformed content' })
            return
        }

        const post = await Post.findById(postId)
        if (!post) {
            res.status(404).json({ message: 'Post not found' })
            return
        }

        const comment = await Comment.create({
            content,
            author: req.userId,
        })
        
        post.comments.push(comment)
        await post.save()

        res.status(201).json({ id: comment._id })      

    } catch (error) {
        console.error(error)
        res.status(500).send()
    }
}

const deleteComment = async(req: Request, res: Response) => {
    try {
        const {commentId, postId} = req.params

        if (!isValidObjectId(postId)) {
            console.log('postID', 1)
            res.status(400).json({message: 'Invalid post id'})
            return
        }

        if (!isValidObjectId(commentId)) {
            res.status(400).json({message: 'Invalid comment id'})
            return
        }

        const post = await Post.findById(postId)
        if (!post) {
            res.status(404).json({message: 'Post not found'})
            return
        }
        const comment = post.comments.find(comment => comment._id instanceof Types.ObjectId && comment._id.toString() === commentId);
        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return 
        }

        if (post.author.toString() !== req.userId && comment.author.toString() !== req.userId) {
            res.status(403).json({ message: 'You are not allowed to delete this comment' });
            return 
        }

        const commentIndex = post.comments.findIndex(comment => comment._id instanceof Types.ObjectId && comment._id.toString() === commentId)
        if (commentIndex === -1) {
            res.status(404).json({ message: 'Comment not found' })
            return
        }

        post.comments.splice(commentIndex, 1)
        await post.save()

        await Comment.findByIdAndDelete(commentId);

        res.status(200).json({message: 'Comment deleted'})

    } catch(error) {
        console.error(error)
        res.status(500).send()
    }
}

export const postRouter = Router()

postRouter.get('/posts', getPosts)
postRouter.get('/posts/:id', getPost)
postRouter.post('/posts', authenticate, createPost)
postRouter.delete('/posts/:id', authenticate, deletePost)
postRouter.put('/posts/:id', authenticate, editPost)
postRouter.post('/posts/:id/comments', authenticate, addComment)
postRouter.delete('/posts/:postId/comments/:commentId', authenticate, deleteComment)